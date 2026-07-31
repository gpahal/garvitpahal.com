import Anthropic, { APIError } from '@anthropic-ai/sdk'
import { z } from 'zod'

import type { VisionModel } from '@/lib/vision/model'
import { getAnthropicApiKey } from '@/lib/x/env'
import { elapsedMs, logErrorEvent, logEvent } from '@/lib/x/log'

/** Caps thinking *plus* the response: a budget sized for the reply alone returns `max_tokens`. */
const MAX_TOKENS = 32_000

/** Fail rather than hang. Worst-case wall clock is this times `MAX_RETRIES + 1`. */
const REQUEST_TIMEOUT_MS = 90_000

/** The SDK retries 408/409/429/5xx. One retry is worth the added latency; the default two is not. */
const MAX_RETRIES = 1

export type ExtractStructuredOptions<T> = {
  image: {
    mediaType: string
    /** Base64, without a data-URL prefix. */
    data: string
  }
  /** JSON Schema handed to the model, constraining what it may produce. */
  schema: Record<string, unknown>
  /** Zod schema the reply is parsed with. The model is constrained, not trusted. */
  responseSchema: z.ZodType<T>
  prompt: string
  model: VisionModel
  maxTokens?: number
  /** Ties every log line for this call back to the browser request that caused it. */
  requestId: string
}

export class VisionExtractionError extends Error {
  readonly reason: 'not_configured' | 'refusal' | 'truncated' | 'empty' | 'unparseable' | 'upstream'

  constructor(reason: VisionExtractionError['reason'], message: string) {
    super(message)
    this.name = 'VisionExtractionError'
    this.reason = reason
  }
}

export async function extractStructured<T>(options: ExtractStructuredOptions<T>): Promise<T> {
  const { model, requestId } = options

  // A missing secret would otherwise surface as "could not read that image".
  let apiKey: string
  try {
    apiKey = getAnthropicApiKey()
  } catch {
    logErrorEvent('vision.not_configured', { requestId })
    throw new VisionExtractionError(
      'not_configured',
      'The puzzle solver is not configured on this server',
    )
  }

  // `process.env` is not available in workerd, so the key is passed explicitly.
  const client = new Anthropic({
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
    // Without the SDK's own warnings, a retried request looks like one slow request.
    logLevel: 'warn',
    logger: console,
  })

  const maxTokens = options.maxTokens ?? MAX_TOKENS
  const startedAt = Date.now()

  logEvent('vision.request', {
    requestId,
    model: model.id,
    effort: model.effort ?? null,
    maxTokens,
    timeoutMs: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
    mediaType: options.image.mediaType,
    imageBytes: approximateDecodedBytes(options.image.data),
  })

  // Streaming, not `messages.create`: at this `max_tokens` a non-streaming request risks the SDK's
  // HTTP timeout, and the event stream gives a time-to-first-token.
  const stream = client.messages.stream({
    model: model.id,
    max_tokens: maxTokens,
    output_config: {
      ...(model.effort && { effort: model.effort }),
      format: {
        type: 'json_schema',
        schema: options.schema,
      },
    },
    messages: [
      {
        role: 'user',
        content: [
          // Image before text: the model reads the instructions against an image it has seen.
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: options.image.mediaType as 'image/jpeg',
              data: options.image.data,
            },
          },
          { type: 'text', text: options.prompt },
        ],
      },
    ],
  })

  let firstEventMs: number | undefined
  stream.on('streamEvent', () => {
    firstEventMs ??= elapsedMs(startedAt)
  })

  let message: Anthropic.Message
  try {
    message = await stream.finalMessage()
  } catch (error) {
    logErrorEvent('vision.upstream_failed', {
      requestId,
      model: model.id,
      anthropicRequestId: stream.request_id ?? null,
      ms: elapsedMs(startedAt),
      firstEventMs: firstEventMs ?? null,
      kind: error instanceof Error ? error.name : typeof error,
      status: error instanceof APIError ? error.status : null,
      type: error instanceof APIError ? error.type : null,
      message: error instanceof Error ? error.message : String(error),
    })
    throw new VisionExtractionError(
      'upstream',
      error instanceof Error ? error.message : 'Model request failed',
    )
  }

  const usage = message.usage
  logEvent('vision.model_response', {
    requestId,
    model: model.id,
    anthropicRequestId: stream.request_id ?? null,
    ms: elapsedMs(startedAt),
    firstEventMs: firstEventMs ?? null,
    stopReason: message.stop_reason,
    maxTokens,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    thinkingTokens: usage.output_tokens_details?.thinking_tokens ?? null,
  })

  if (message.stop_reason === 'refusal') {
    logErrorEvent('vision.refused', {
      requestId,
      model: model.id,
      anthropicRequestId: stream.request_id ?? null,
      category: message.stop_details?.category ?? null,
    })
    throw new VisionExtractionError('refusal', 'The model declined to read this image')
  }
  if (message.stop_reason === 'max_tokens') {
    logErrorEvent('vision.truncated', {
      requestId,
      model: model.id,
      anthropicRequestId: stream.request_id ?? null,
      maxTokens,
      outputTokens: usage.output_tokens,
      thinkingTokens: usage.output_tokens_details?.thinking_tokens ?? null,
      hint: 'raise MAX_TOKENS or lower the model effort in src/lib/vision/extract.ts',
    })
    throw new VisionExtractionError('truncated', 'The model ran out of room before finishing')
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  if (text.trim() === '') {
    logErrorEvent('vision.empty', {
      requestId,
      model: model.id,
      anthropicRequestId: stream.request_id ?? null,
      blockTypes: message.content.map((block) => block.type),
    })
    throw new VisionExtractionError('empty', 'The model returned no content')
  }

  const parsed = parseResponse(options.responseSchema, text)
  if (!parsed.success) {
    logErrorEvent('vision.unparseable', {
      requestId,
      model: model.id,
      anthropicRequestId: stream.request_id ?? null,
      textChars: text.length,
      reason: parsed.reason,
      textStart: text.slice(0, 200),
    })
    throw new VisionExtractionError('unparseable', 'The model returned malformed JSON')
  }

  logEvent('vision.ok', {
    requestId,
    model: model.id,
    ms: elapsedMs(startedAt),
    textChars: text.length,
  })
  return parsed.data
}

/** The model is constrained by the schema, not trusted to have obeyed it. */
function parseResponse<T>(
  schema: z.ZodType<T>,
  text: string,
): { success: true; data: T } | { success: false; reason: string } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { success: false, reason: 'invalid json' }
  }

  const result = schema.safeParse(json)
  return result.success
    ? { success: true, data: result.data }
    : { success: false, reason: z.prettifyError(result.error) }
}

/** Base64 is 4 characters per 3 bytes; padding makes this an over-estimate by at most 2 bytes. */
function approximateDecodedBytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4)
}
