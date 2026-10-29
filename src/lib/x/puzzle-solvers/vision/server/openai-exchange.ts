import type OpenAI from 'openai'
import { z } from 'zod'

import { SERVER_SETTINGS_MESSAGE } from '@/lib/failure'
import { elapsedMs, errorText, logErrorEvent, logEvent } from '@/lib/server/log'

import { UNREADABLE_MESSAGE } from '../extract-wire'
import type { ExtractError } from '../extract-wire'
import type { ChainModel } from './models'

/**
 * The call is a bare `fetch` because the SDK's client would add most of a megabyte to the Worker,
 * evaluated within the first read's CPU allowance.
 */

export type ExtractStructuredOptions<T> = {
  /**
   * The picture as a JPEG data URL.
   */
  image: string
  schema: Record<string, unknown>
  /**
   * Parses the reply: the model is constrained by `schema`, not trusted to have obeyed it.
   */
  responseSchema: z.ZodType<T>
  prompt: string
  model: ChainModel
  requestId: string
  /**
   * The call's only deadline: it aborts at the request's deadline or when the browser leaves.
   */
  signal: AbortSignal
}

/**
 * Every message is fixed here. The provider's wording is logged, never forwarded: it carries account
 * and quota detail and, on an auth failure, a masked fragment of the key.
 */
export type StructuredReply<T> = { ok: true; data: T } | { ok: false; error: ExtractError }

export const NOT_CONFIGURED: ExtractError = {
  code: 'not_configured',
  message: SERVER_SETTINGS_MESSAGE,
}

export const UNREADABLE: ExtractError = {
  code: 'model_failed',
  message: UNREADABLE_MESSAGE,
}

const GENERATION_FAILED: ExtractError = {
  code: 'model_failed',
  message: 'OpenAI could not finish reading the picture. Try again',
}

type ProviderFailure = {
  status?: number | undefined
  code?: string | null | undefined
  type?: string | null | undefined
  message?: string | null | undefined
}

/**
 * Refusals every call would meet, the fallback model included, since it gets the same account and
 * picture. The billing codes arrive as a 429 like a plain rate limit, but waiting will not help.
 */
function refusalNamed(name: string | null | undefined): 'account' | 'picture' | undefined {
  switch (name ?? '') {
    case 'insufficient_quota':
    case 'organization_spend_limit_exceeded':
    case 'project_spend_limit_exceeded':
    case 'organization_usage_limit_exceeded':
    case 'credit_balance_exhausted':
    case 'invalid_api_key': {
      return 'account'
    }
    case 'invalid_image':
    case 'invalid_image_format':
    case 'invalid_base64_image':
    case 'image_too_large':
    case 'image_too_small':
    case 'image_parse_error':
    case 'image_content_policy_violation':
    case 'invalid_image_mode':
    case 'image_file_too_large':
    case 'unsupported_image_media_type':
    case 'empty_image_file': {
      return 'picture'
    }
    default: {
      return undefined
    }
  }
}

/**
 * 429, 408 and 409 pass with time and any other 4xx refuses this request. Anything else, a
 * connection failure included, stays `model_failed`, so the fallback and Try again remain.
 */
export function classifyFailure({ status, code, type }: ProviderFailure): ExtractError {
  if (
    status === 401 ||
    status === 403 ||
    refusalNamed(code) === 'account' ||
    refusalNamed(type) === 'account'
  ) {
    return {
      code: 'account_rejected',
      message:
        'Reading is unavailable: the OpenAI account refused the request. Check its spend limit and API key',
    }
  }
  if (refusalNamed(code) === 'picture') {
    return {
      code: 'model_rejected',
      message: 'OpenAI could not use this picture. Choose another picture',
    }
  }
  switch (status) {
    case undefined: {
      return { code: 'model_failed', message: 'OpenAI could not be reached. Try again' }
    }
    case 429: {
      return {
        code: 'model_failed',
        message: 'OpenAI is limiting requests right now. Try again shortly',
      }
    }
    case 408:
    case 409: {
      return GENERATION_FAILED
    }
    default: {
      return status >= 400 && status < 500
        ? {
            code: 'model_refused',
            message: 'OpenAI refused the request. Enter the puzzle by hand for now',
          }
        : GENERATION_FAILED
    }
  }
}

/**
 * Caps reasoning *plus* the response: a budget sized for the reply alone returns `incomplete`.
 */
export const MAX_TOKENS = 32_000

/**
 * Thin grid borders are lost to low-fidelity resampling, and a mis-traced border is this feature's
 * main failure.
 */
const IMAGE_DETAIL = 'high'

const SCHEMA_NAME = 'puzzle_extraction'

const RESPONSES_URL = 'https://api.openai.com/v1/responses'

/**
 * Sent once: the browser's requests, one call each, bound spending, so a retry here would be a
 * hidden paid call. Not streamed: parsing one event per token on a large grid would spend most of
 * the Worker's CPU allowance.
 */
function visionRequest(options: ExtractStructuredOptions<unknown>, apiKey: string): RequestInit {
  const { model } = options
  const body: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
    model: model.id,
    max_output_tokens: MAX_TOKENS,
    ...(model.effort && { reasoning: { effort: model.effort } }),
    ...(model.tier && { service_tier: model.tier }),
    // A read is never continued, so nothing is kept on the provider's side.
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: SCHEMA_NAME,
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
            image_url: options.image,
            detail: IMAGE_DETAIL,
          },
          { type: 'input_text', text: options.prompt },
        ],
      },
    ],
  }
  return {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  }
}

const providerErrorSchema = z.object({
  error: z.object({
    code: z.string().nullish(),
    type: z.string().nullish(),
    message: z.string().nullish(),
  }),
})

/**
 * A gateway in front of the API may send any body, which leaves only the status.
 */
function providerFailureOf(status: number, body: unknown): ProviderFailure {
  const parsed = providerErrorSchema.safeParse(body)
  return parsed.success ? { status, ...parsed.data.error } : { status }
}

const otherPartSchema = z.object({ type: z.string().refine((type) => type !== 'output_text') })

const textPartSchema = z.object({ type: z.literal('output_text'), text: z.string() })

const messagePartSchema = z.union([textPartSchema, otherPartSchema])

const outputItemSchema = z.union([
  z.object({ type: z.literal('message'), content: z.array(messagePartSchema) }),
  // Reasoning and any newer item type, which carry nothing read here.
  z.object({ type: z.string().refine((type) => type !== 'message') }),
])

/**
 * Only the fields read here are validated. `output` may be absent only from a reply that did not
 * complete.
 */
const visionResponseSchema = z.object({
  id: z.string().optional().catch(undefined),
  service_tier: z.string().nullish().catch(undefined),
  status: z.string(),
  error: z.object({ code: z.string().nullish(), message: z.string().nullish() }).nullish(),
  incomplete_details: z.object({ reason: z.string().nullish() }).nullish(),
  output: z.array(outputItemSchema).optional(),
  // Logged as it came, so a change in its shape never fails a read.
  usage: z.unknown().optional(),
})

export type VisionResponse = z.infer<typeof visionResponseSchema>

/**
 * Joins the text as the SDK's `output_text` does. A refusal is a content part, not a stop reason, so
 * unless looked for it would read as an empty reply.
 */
function readOutput(output: NonNullable<VisionResponse['output']>): {
  text: string
  isRefused: boolean
} {
  let text = ''
  let isRefused = false
  for (const item of output) {
    if (!('content' in item)) continue
    for (const part of item.content) {
      if ('text' in part) text += part.text
      else if (part.type === 'refusal') isRefused = true
    }
  }
  return { text, isRefused }
}

export function interpretResponse<T>(
  response: VisionResponse,
  responseSchema: z.ZodType<T>,
  logError: (event: string, fields: Record<string, unknown>) => void,
): StructuredReply<T> {
  const fail = (error: ExtractError, event: string, fields: Record<string, unknown>) => {
    logError(event, fields)
    return { ok: false, error } as const
  }
  // A server-side failure arrives as a normal response, which would otherwise read as empty.
  if (response.status === 'failed') {
    const error = classifyFailure({ status: 500, code: response.error?.code })
    return fail(error, 'vision.upstream_failed', {
      failure: error.code,
      code: response.error?.code ?? null,
      message: response.error?.message ?? null,
    })
  }

  const { text, isRefused } = readOutput(response.output ?? [])
  if (isRefused) return fail(UNREADABLE, 'vision.refused', {})
  if (response.status === 'incomplete') {
    // In the log, `reason` tells `max_output_tokens`, the budget running out, from a stop that more
    // room would not fix.
    return fail(UNREADABLE, 'vision.truncated', {
      reason: response.incomplete_details?.reason ?? null,
      maxTokens: MAX_TOKENS,
      usage: response.usage,
    })
  }
  // Neither completed nor failed: the provider's fault rather than the picture's.
  if (response.status !== 'completed' || response.output === undefined) {
    return fail(GENERATION_FAILED, 'vision.malformed_reply', {
      status: response.status,
      hasOutput: response.output !== undefined,
    })
  }
  if (text.trim() === '') {
    return fail(UNREADABLE, 'vision.empty', {
      itemTypes: response.output.map((item) => item.type),
    })
  }

  const parsed = parseResponse(responseSchema, text)
  if (!parsed.success) {
    return fail(UNREADABLE, 'vision.unparseable', {
      textChars: text.length,
      reason: parsed.reason,
      textStart: text.slice(0, 200),
    })
  }
  return { ok: true, data: parsed.data }
}

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

const NOT_JSON = Symbol('not JSON')

type ExchangeDeps = { apiKey: string; fetchFn: typeof fetch }

/**
 * Rejects only on an abort, which whoever aborted accounts for, or on an unexpected throw, which the
 * read session logs.
 */
export async function extractStructured<T>(
  options: ExtractStructuredOptions<T>,
  { apiKey, fetchFn }: ExchangeDeps,
): Promise<StructuredReply<T>> {
  const { model, requestId, signal } = options
  const startedAt = Date.now()
  const call = { requestId, model: model.id, effort: model.effort ?? null }
  const failed = (failure: ProviderFailure, kind: string): StructuredReply<T> => {
    const error = classifyFailure(failure)
    logErrorEvent('vision.upstream_failed', {
      ...call,
      ms: elapsedMs(startedAt),
      failure: error.code,
      kind,
      status: failure.status ?? null,
      code: failure.code ?? null,
      type: failure.type ?? null,
      message: failure.message ?? null,
    })
    return { ok: false, error }
  }

  let answer: Response
  let body: unknown
  try {
    answer = await fetchFn(RESPONSES_URL, visionRequest(options, apiKey))
    try {
      body = await answer.json()
    } catch (error) {
      if (signal.aborted) throw error
      body = NOT_JSON
    }
  } catch (error) {
    if (signal.aborted) throw error
    return failed({ message: errorText(error) }, error instanceof Error ? error.name : typeof error)
  }
  if (!answer.ok) return failed(providerFailureOf(answer.status, body), 'http_error')
  if (body === NOT_JSON) {
    return failed({ status: answer.status, message: 'The reply was not JSON' }, 'not_json')
  }

  const parsed = visionResponseSchema.safeParse(body)
  if (!parsed.success) {
    // The issues name paths and expected types, never the reply's own values.
    logErrorEvent('vision.malformed_reply', {
      ...call,
      ms: elapsedMs(startedAt),
      reason: z.prettifyError(parsed.error),
    })
    return { ok: false, error: GENERATION_FAILED }
  }
  const response = parsed.data
  const reply = { ...call, responseId: response.id ?? null }
  logEvent('vision.model_response', {
    ...reply,
    ms: elapsedMs(startedAt),
    status: response.status,
    incompleteReason: response.incomplete_details?.reason ?? null,
    // Not always the tier asked for.
    serviceTier: response.service_tier ?? null,
    maxTokens: MAX_TOKENS,
    usage: response.usage,
  })
  return interpretResponse(response, options.responseSchema, (event, fields) => {
    logErrorEvent(event, { ...reply, ms: elapsedMs(startedAt), ...fields })
  })
}
