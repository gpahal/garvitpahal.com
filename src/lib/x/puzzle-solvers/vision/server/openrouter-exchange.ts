import type { ChatRequest$Outbound } from '@openrouter/sdk/models'
import { z } from 'zod'

import { SERVER_SETTINGS_MESSAGE } from '@/lib/failure'
import { elapsedMs, errorText, logErrorEvent, logEvent } from '@/lib/server/log'

import { UNREADABLE_MESSAGE } from '../extract-wire'
import type { ExtractError } from '../extract-wire'
import type { ChainModel } from './models'

/**
 * The call is a bare `fetch` typed by the SDK's wire types. Even its smallest client, `chatSend`
 * on `OpenRouterCore`, measured about 11 ms of module evaluation, which would land on the first
 * read's 10 ms CPU allowance on the Workers Free plan.
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
 * and quota detail.
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
  message: 'The model could not finish reading the picture. Try again',
}

type ProviderFailure = {
  /**
   * The HTTP status, or the `code` of an error that arrived inside a 200 reply.
   */
  status?: number | undefined
  /**
   * The upstream provider's own code, such as `invalid_image`.
   */
  providerCode?: string | undefined
  errorType?: string | undefined
  providerName?: string | undefined
  /**
   * OpenRouter's moderation flagged the input, which every model behind it would meet too.
   */
  isModeration?: boolean | undefined
  message?: string | undefined
}

/**
 * Codes the upstream provider gives a picture it cannot use: the fallback gets the same picture.
 */
const PICTURE_CODES = new Set([
  'invalid_image',
  'invalid_image_format',
  'invalid_base64_image',
  'image_too_large',
  'image_too_small',
  'image_parse_error',
  'image_content_policy_violation',
  'invalid_image_mode',
  'image_file_too_large',
  'unsupported_image_media_type',
  'empty_image_file',
])

/**
 * 401, 402 and 403 are the account's (key, credits or guardrails), which the fallback shares; 429,
 * 408 and 409 pass with time and any other 4xx refuses this request. Anything else, a connection
 * failure included, stays `model_failed`, so the fallback and Try again remain.
 */
export function classifyFailure({
  status,
  providerCode,
  isModeration,
}: ProviderFailure): ExtractError {
  if (isModeration || (providerCode !== undefined && PICTURE_CODES.has(providerCode))) {
    return {
      code: 'model_rejected',
      message: 'The model could not use this picture. Choose another picture',
    }
  }
  if (status === 401 || status === 402 || status === 403) {
    return {
      code: 'account_rejected',
      message:
        'Reading is unavailable: the OpenRouter account refused the request. Check its credits and API key',
    }
  }
  switch (status) {
    case undefined: {
      return { code: 'model_failed', message: 'OpenRouter could not be reached. Try again' }
    }
    case 429: {
      return {
        code: 'model_failed',
        message: 'OpenRouter is limiting requests right now. Try again shortly',
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
            message: 'OpenRouter refused the request. Enter the puzzle by hand for now',
          }
        : GENERATION_FAILED
    }
  }
}

/**
 * Caps reasoning *plus* the response: a budget sized for the reply alone stops at `length`.
 */
export const MAX_TOKENS = 32_000

/**
 * Thin grid borders are lost to low-fidelity resampling, and a mis-traced border is this feature's
 * main failure.
 */
const IMAGE_DETAIL = 'high'

const SCHEMA_NAME = 'puzzle_extraction'

const CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Sent once: the browser's requests, one call each, bound spending, so a retry here would be a
 * hidden paid call. Not streamed: parsing one event per token on a large grid would spend most of
 * the Worker's CPU allowance.
 */
function visionRequest(options: ExtractStructuredOptions<unknown>, apiKey: string): RequestInit {
  const { model } = options
  const body: ChatRequest$Outbound = {
    model: model.id,
    stream: false,
    max_tokens: MAX_TOKENS,
    ...(model.effort && { reasoning: { effort: model.effort } }),
    ...(model.tier && { service_tier: model.tier }),
    // Otherwise OpenRouter may route to a provider that ignores the schema or the effort.
    provider: { require_parameters: true },
    response_format: {
      type: 'json_schema',
      json_schema: { name: SCHEMA_NAME, strict: true, schema: options.schema },
    },
    messages: [
      {
        role: 'user',
        content: [
          // Image before text: the model reads the instructions against an image it has seen.
          { type: 'image_url', image_url: { url: options.image, detail: IMAGE_DETAIL } },
          { type: 'text', text: options.prompt },
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

const optionalText = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined)

/**
 * Unread metadata, such as a moderation flag's `flagged_input`, is stripped so it never reaches a
 * log.
 */
const providerErrorSchema = z.object({
  code: z.number().optional().catch(undefined),
  message: z.string().optional().catch(undefined),
  metadata: z
    .object({
      provider_name: optionalText,
      provider_code: optionalText,
      error_type: optionalText,
      reasons: z.array(z.unknown()).optional().catch(undefined),
    })
    .nullish()
    .catch(undefined),
})

type ProviderError = z.infer<typeof providerErrorSchema>

function failureOf(status: number | undefined, error: ProviderError): ProviderFailure {
  return {
    status,
    providerCode: error.metadata?.provider_code,
    errorType: error.metadata?.error_type,
    providerName: error.metadata?.provider_name,
    isModeration: error.metadata?.reasons !== undefined,
    message: error.message,
  }
}

/**
 * A gateway in front of the API may send any body, which leaves only the status.
 */
function providerFailureOf(status: number, body: unknown): ProviderFailure {
  const parsed = z.object({ error: providerErrorSchema }).safeParse(body)
  return parsed.success ? failureOf(status, parsed.data.error) : { status }
}

function failureFields(failure: ProviderFailure): Record<string, unknown> {
  return {
    status: failure.status ?? null,
    providerCode: failure.providerCode ?? null,
    errorType: failure.errorType ?? null,
    providerName: failure.providerName ?? null,
    isModeration: failure.isModeration ?? false,
    message: failure.message ?? null,
  }
}

const contentPartSchema = z.union([
  z.object({ type: z.literal('text'), text: z.string() }),
  // Any other part type carries nothing read here.
  z.object({ type: z.string() }),
])

const choiceSchema = z.object({
  finish_reason: z.string().nullish(),
  native_finish_reason: z.string().nullish().catch(undefined),
  message: z
    .object({
      content: z.union([z.string(), z.array(contentPartSchema)]).nullish(),
      refusal: z.string().nullish(),
    })
    .optional(),
  error: providerErrorSchema.nullish(),
})

/**
 * Only the fields read here are validated. A generation error can arrive with a 200, either in
 * `error` with no choices or on a choice whose `finish_reason` is `error`.
 */
const visionResponseSchema = z.object({
  id: z.string().optional().catch(undefined),
  model: z.string().optional().catch(undefined),
  provider: z.string().optional().catch(undefined),
  // Not always the tier asked for, and billed as the one used.
  service_tier: z.string().nullish().catch(undefined),
  error: providerErrorSchema.nullish(),
  choices: z.array(choiceSchema).optional(),
  // Logged as it came, so a change in its shape never fails a read.
  usage: z.unknown().optional(),
})

export type VisionResponse = z.infer<typeof visionResponseSchema>

type Choice = z.infer<typeof choiceSchema>

function textOf(content: NonNullable<Choice['message']>['content']): string {
  if (typeof content === 'string') return content
  return (content ?? []).map((part) => ('text' in part ? part.text : '')).join('')
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
  const choice = response.choices?.[0]
  const finishReason = choice?.finish_reason ?? null
  const error = choice?.error ?? response.error ?? undefined
  // Without a code, an error inside a 200 reads as the provider's fault rather than the request's.
  if (error !== undefined || finishReason === 'error') {
    const failure = failureOf(error?.code ?? 500, error ?? {})
    const extractError = classifyFailure(failure)
    return fail(extractError, 'vision.upstream_failed', {
      failure: extractError.code,
      kind: 'in_reply',
      ...failureFields(failure),
    })
  }

  const finish = { finishReason, nativeFinishReason: choice?.native_finish_reason ?? null }
  // A refusal is a field beside the content, not a stop reason, so unless looked for it would read
  // as an empty reply.
  const refusal = choice?.message?.refusal ?? ''
  if (finishReason === 'content_filter' || refusal !== '') {
    return fail(UNREADABLE, 'vision.refused', finish)
  }
  if (finishReason === 'length') {
    return fail(UNREADABLE, 'vision.truncated', {
      ...finish,
      maxTokens: MAX_TOKENS,
      usage: response.usage,
    })
  }
  // The schema check below catches a reply cut short without a stop reason.
  if (choice === undefined || (finishReason !== null && finishReason !== 'stop')) {
    return fail(GENERATION_FAILED, 'vision.malformed_reply', {
      ...finish,
      choices: response.choices?.length ?? null,
    })
  }
  const text = textOf(choice.message?.content)
  if (text.trim() === '') {
    return fail(UNREADABLE, 'vision.empty', {
      ...finish,
      contentType: Array.isArray(choice.message?.content)
        ? choice.message.content.map((part) => part.type)
        : typeof choice.message?.content,
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
      ...failureFields(failure),
    })
    return { ok: false, error }
  }

  let answer: Response
  let body: unknown
  try {
    answer = await fetchFn(CHAT_COMPLETIONS_URL, visionRequest(options, apiKey))
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
    servedBy: response.provider ?? null,
    servedModel: response.model ?? null,
    finishReason: response.choices?.[0]?.finish_reason ?? null,
    serviceTier: response.service_tier ?? null,
    maxTokens: MAX_TOKENS,
    // Includes OpenRouter's `cost` in credits.
    usage: response.usage,
  })
  return interpretResponse(response, options.responseSchema, (event, fields) => {
    logErrorEvent(event, { ...reply, ms: elapsedMs(startedAt), ...fields })
  })
}
