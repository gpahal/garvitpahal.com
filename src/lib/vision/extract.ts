import OpenAI, { APIError, APIUserAbortError } from 'openai'
import { z } from 'zod'

import type { VisionModel } from '@/lib/vision/model'
import { getOpenAiApiKey } from '@/lib/x/env'
import { elapsedMs, logErrorEvent, logEvent } from '@/lib/x/log'

/**
Caps reasoning *plus* the response: a budget sized for the reply alone returns `incomplete`.
*/
const MAX_TOKENS = 32_000

/**
 * A safety net only. The endpoint's own deadline is what bounds a read, and it aborts this call
 * through `signal` well before this fires; this exists so a call the endpoint lost track of cannot
 * sit open forever.
 */
const REQUEST_TIMEOUT_MS = 180_000

/**
 * No SDK retries: the hedge is the retry. A retried call would also silently take a second slot of
 * the Worker's outbound connection cap while the original was still counted against it.
 */
const MAX_RETRIES = 0

/**
 * Grid borders are thin and easily lost to resampling, and a mis-traced border is the failure this
 * whole feature turns on, so the image is never sent at low fidelity.
 */
const IMAGE_DETAIL = 'high'

/**
Names the schema for the provider's logs; not shown to the model.
*/
const SCHEMA_NAME = 'puzzle_extraction'

export type ExtractStructuredOptions<T> = {
  image: {
    mediaType: string
    /**
    Base64, without a data-URL prefix.
    */
    data: string
  }
  /**
  JSON Schema handed to the model, constraining what it may produce.
  */
  schema: Record<string, unknown>
  /**
  Zod schema the reply is parsed with. The model is constrained, not trusted.
  */
  responseSchema: z.ZodType<T>
  prompt: string
  model: VisionModel
  maxTokens?: number
  /**
  Ties every log line for this call back to the browser request that caused it.
  */
  requestId: string
  /**
  Cancels the call. A hedge that lost the race is cut off here rather than left to finish.
  */
  signal?: AbortSignal
}

export class VisionExtractionError extends Error {
  readonly reason:
    'not_configured' | 'refusal' | 'truncated' | 'empty' | 'unparseable' | 'upstream' | 'aborted'

  constructor(reason: VisionExtractionError['reason'], message: string) {
    super(message)
    this.name = 'VisionExtractionError'
    this.reason = reason
  }
}

/**
At most one entry: the key it was built for, so a rotated secret is picked up.
*/
const clients = new Map<string, OpenAI>()

/**
 * One client per isolate, keyed by the secret so a rotated key is picked up. Throws
 * `not_configured` so the endpoint can answer 503 before it has committed to a stream.
 */
export function getVisionClient(): OpenAI {
  // A missing secret would otherwise surface as "could not read that image".
  let apiKey: string
  try {
    apiKey = getOpenAiApiKey()
  } catch {
    throw new VisionExtractionError(
      'not_configured',
      'The puzzle solver is not configured on this server',
    )
  }
  let instance = clients.get(apiKey)
  if (!instance) {
    clients.clear()
    // `process.env` is not available in workerd, so the key is passed explicitly.
    instance = new OpenAI({
      apiKey,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
      logLevel: 'warn',
      logger: console,
    })
    clients.set(apiKey, instance)
  }
  return instance
}

export async function extractStructured<T>(options: ExtractStructuredOptions<T>): Promise<T> {
  const { model, requestId, signal } = options
  const openai = getVisionClient()
  const maxTokens = options.maxTokens ?? MAX_TOKENS
  const startedAt = Date.now()

  logEvent('vision.request', {
    requestId,
    model: model.id,
    effort: model.effort ?? null,
    tier: model.tier ?? null,
    maxTokens,
    mediaType: options.image.mediaType,
    imageBytes: approximateDecodedBytes(options.image.data.length),
  })

  // Streaming, not `responses.create`: at this token budget a single non-streaming request can sit
  // open for minutes, and the event stream gives a time-to-first-token.
  const stream = openai.responses.stream(
    {
      model: model.id,
      max_output_tokens: maxTokens,
      ...(model.effort && { reasoning: { effort: model.effort } }),
      ...(model.tier && { service_tier: model.tier }),
      // Nothing here is worth keeping on the provider's side, and a read is never continued.
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: SCHEMA_NAME,
          // Rejects any reply that leaves the schema, rather than letting the parser find out later.
          strict: true,
          schema: options.schema,
        },
        // Only the JSON is wanted; there is no prose for this to shorten, but it says so.
        verbosity: 'low',
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
    },
    { signal },
  )

  let firstEventMs: number | undefined
  stream.on('event', () => {
    firstEventMs ??= elapsedMs(startedAt)
  })

  let response: Awaited<ReturnType<typeof stream.finalResponse>>
  try {
    response = await stream.finalResponse()
  } catch (error) {
    // The endpoint cuts a hedge off once it has what it needs; that is the plan working, not a
    // failure, so it is logged at info and reported as its own reason.
    if (error instanceof APIUserAbortError || signal?.aborted) {
      logEvent('vision.aborted', {
        requestId,
        model: model.id,
        effort: model.effort ?? null,
        ms: elapsedMs(startedAt),
        firstEventMs: firstEventMs ?? null,
      })
      throw new VisionExtractionError('aborted', 'The read was cancelled')
    }
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
    effort: model.effort ?? null,
    responseId: response.id,
    ms: elapsedMs(startedAt),
    firstEventMs: firstEventMs ?? null,
    status: response.status ?? null,
    incompleteReason: response.incomplete_details?.reason ?? null,
    // What the provider actually served, which is not always what was asked for.
    serviceTier: response.service_tier ?? null,
    maxTokens,
    inputTokens: usage?.input_tokens ?? null,
    cachedTokens: usage?.input_tokens_details?.cached_tokens ?? null,
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
    effort: model.effort ?? null,
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

/**
The model is constrained by the schema, not trusted to have obeyed it.
*/
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
