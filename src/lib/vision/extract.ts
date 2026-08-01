import OpenAI, { APIError } from 'openai'
import { z } from 'zod'

import type { VisionModel } from '@/lib/vision/model'
import { getOpenAiApiKey } from '@/lib/x/env'
import { elapsedMs, logErrorEvent, logEvent } from '@/lib/x/log'

/** Caps reasoning *plus* the response: a budget sized for the reply alone returns `incomplete`. */
const MAX_TOKENS = 32_000

/**
 * Fail rather than hang. Worst-case wall clock is this times `MAX_RETRIES + 1`. The slowest single
 * read measured across the current chain was ~75s, on the hardest grid at the highest effort, so
 * this leaves headroom without letting a stalled call sit open for minutes.
 */
const REQUEST_TIMEOUT_MS = 120_000

/** The SDK retries 408/409/429/5xx. One retry is worth the added latency; the default two is not. */
const MAX_RETRIES = 1

/**
 * Grid borders are thin and easily lost to resampling, and a mis-traced border is the failure this
 * whole feature turns on, so the image is never sent at low fidelity.
 */
const IMAGE_DETAIL = 'high'

/** Names the schema for the provider's logs; not shown to the model. */
const SCHEMA_NAME = 'puzzle_extraction'

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
    apiKey = getOpenAiApiKey()
  } catch {
    logErrorEvent('vision.not_configured', { requestId })
    throw new VisionExtractionError(
      'not_configured',
      'The puzzle solver is not configured on this server',
    )
  }

  // `process.env` is not available in workerd, so the key is passed explicitly.
  const client = new OpenAI({
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
    imageBytes: approximateDecodedBytes(options.image.data.length),
  })

  // Streaming, not `responses.create`: at this token budget a single non-streaming request can sit
  // open for minutes, and the event stream gives a time-to-first-token.
  const stream = client.responses.stream({
    model: model.id,
    max_output_tokens: maxTokens,
    ...(model.effort && { reasoning: { effort: model.effort } }),
    text: {
      format: {
        type: 'json_schema',
        name: SCHEMA_NAME,
        // Rejects any reply that leaves the schema, rather than letting the parser find out later.
        strict: true,
        schema: options.schema,
      },
    },
    input: [
      {
        role: 'user',
        content: [
          // Image before text: the model reads the instructions against an image it has seen.
          {
            type: 'input_image',
            image_url: `data:${options.image.mediaType};base64,${options.image.data}`,
            detail: IMAGE_DETAIL,
          },
          { type: 'input_text', text: options.prompt },
        ],
      },
    ],
  })

  let firstEventMs: number | undefined
  stream.on('event', () => {
    firstEventMs ??= elapsedMs(startedAt)
  })

  let response: Awaited<ReturnType<typeof stream.finalResponse>>
  try {
    response = await stream.finalResponse()
  } catch (error) {
    logErrorEvent('vision.upstream_failed', {
      requestId,
      model: model.id,
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

  const usage = response.usage
  logEvent('vision.model_response', {
    requestId,
    model: model.id,
    responseId: response.id,
    ms: elapsedMs(startedAt),
    firstEventMs: firstEventMs ?? null,
    status: response.status ?? null,
    incompleteReason: response.incomplete_details?.reason ?? null,
    maxTokens,
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
    reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? null,
  })

  // A generation that failed server-side comes back as a normal response with `status: 'failed'`
  // rather than as a thrown error, so it has to be checked or it looks like an empty reply.
  if (response.status === 'failed') {
    logErrorEvent('vision.upstream_failed', {
      requestId,
      model: model.id,
      responseId: response.id,
      ms: elapsedMs(startedAt),
      code: response.error?.code ?? null,
      message: response.error?.message ?? null,
    })
    throw new VisionExtractionError('upstream', response.error?.message ?? 'Model request failed')
  }

  if (hasRefusal(response)) {
    logErrorEvent('vision.refused', { requestId, model: model.id, responseId: response.id })
    throw new VisionExtractionError('refusal', 'The model declined to read this image')
  }
  if (response.status === 'incomplete') {
    logErrorEvent('vision.truncated', {
      requestId,
      model: model.id,
      responseId: response.id,
      reason: response.incomplete_details?.reason ?? null,
      maxTokens,
      outputTokens: usage?.output_tokens ?? null,
      reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? null,
      hint: 'raise MAX_TOKENS or lower the model effort in src/lib/vision/extract.ts',
    })
    throw new VisionExtractionError('truncated', 'The model ran out of room before finishing')
  }

  const text = response.output_text
  if (text.trim() === '') {
    logErrorEvent('vision.empty', {
      requestId,
      model: model.id,
      responseId: response.id,
      itemTypes: response.output.map((item) => item.type),
    })
    throw new VisionExtractionError('empty', 'The model returned no content')
  }

  const parsed = parseResponse(options.responseSchema, text)
  if (!parsed.success) {
    logErrorEvent('vision.unparseable', {
      requestId,
      model: model.id,
      responseId: response.id,
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

/**
 * A refusal is a content part rather than a stop reason, so it has to be looked for. `output_text`
 * skips those parts, which would otherwise turn a refusal into a confusing "no content".
 */
function hasRefusal(response: { output: Array<unknown> }): boolean {
  for (const item of response.output) {
    if (typeof item !== 'object' || item === null || !('content' in item)) {
      continue
    }
    const content = (item as { content?: Array<{ type?: string }> }).content ?? []
    if (content.some((part) => part.type === 'refusal')) {
      return true
    }
  }
  return false
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

/**
 * Base64 is 4 characters per 3 bytes; padding makes this an over-estimate by at most 2 bytes. Takes
 * a length rather than the string so the endpoint can size a payload it has not read yet.
 */
export function approximateDecodedBytes(base64Length: number): number {
  return Math.floor((base64Length * 3) / 4)
}
