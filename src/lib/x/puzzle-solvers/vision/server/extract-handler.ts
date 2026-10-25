import type { APIContext } from 'astro'

import { z } from 'zod'

import { SERVER_SETTINGS_MESSAGE } from '@/lib/failure'
import { ownerOf } from '@/lib/server/api-gate'
import { elapsedMs, logErrorEvent, logEvent, refusalResponse, scopedLog } from '@/lib/server/log'

import type { ParseResult } from '../../puzzles/types'
import {
  callRank,
  EXTRACT_DEADLINE_MS,
  EXTRACT_MIN_WINDOW_MS,
  OUT_OF_DATE_MESSAGE,
  wireFailure,
} from '../extract-wire'
import type { ExtractError, ExtractRequest } from '../extract-wire'
import { MAX_IMAGE_BYTES } from '../image-limit'
import { isDeclaredOver, readBoundedText } from './bounded-read'
import type { BoundedText } from './bounded-read'
import type { consumeRateLimit } from './convex-server'
import { admissionsOf, modelKey } from './models'
import type { ChainModel, VisionModels } from './models'
import { MAX_TOKENS, NOT_CONFIGURED, UNREADABLE } from './openai-exchange'
import type { ExtractStructuredOptions, StructuredReply } from './openai-exchange'
import { runReadSession } from './read-session'
import type { CallOutcome } from './read-session'
import { toStrictJsonSchema } from './strict-json-schema'

/**
 * `MAX_IMAGE_BYTES` in base64 plus room for the envelope and hints, the largest of which take under
 * 5 KiB. The body is the only size check, so an image may exceed its cap by the room the envelope
 * leaves unused.
 */
export const MAX_BODY_BYTES = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 8 * 1024

const searchSchema = z.object({
  phase: z.enum(['initial', 'fallback']),
  call: z.string().regex(/^\d$/).transform(Number),
})

/**
 * Every JPEG opens with the bytes `FF D8 FF`, which base64 writes as `/9j/`.
 */
const JPEG_BASE64_SIGNATURE = '/9j/'

export const INVALID_REQUEST_MESSAGE =
  'The picture could not be sent. Reload the page and try again'

const UNAVAILABLE_MESSAGES = {
  outage: 'Reading is unavailable right now. Try again shortly',
  misconfigured: SERVER_SETTINGS_MESSAGE,
} as const

/**
 * Use `satisfies HintsShape<T>` on a fresh shape to require every hints key, which a `z.ZodType<T>`
 * annotation alone does not. Hints schemas sit in `server/` folders, not beside the types in
 * `api.ts`, because classic zod is ~20 kB gzipped.
 */
export type HintsShape<T> = { [K in keyof Required<T>]: z.ZodType<T[K]> }

export type ExtractHandlerConfig<TRaw, TPuzzle, TResult, THints extends object> = {
  models: VisionModels
  hintsSchema: z.ZodType<THints>
  prompt: (hints: THints) => string
  responseSchema: z.ZodType<TRaw>
  /**
   * Parse only, no solving: the request's CPU allowance is small, and the browser decides whether a
   * read can be trusted.
   */
  parse: (raw: TRaw) => ParseResult<TPuzzle>
  toWire: (puzzle: TPuzzle) => TResult
  logFields: (puzzle: TPuzzle) => Record<string, unknown>
}

export type Extraction = {
  models: VisionModels
  responseSchema: z.ZodType
  /**
   * Each request ends with exactly one `<puzzleId>.done`, whose `outcome` says how it ended.
   */
  handle: (context: APIContext, puzzleId: string, deps: ExtractHandlerDeps) => Promise<Response>
}

/**
 * The `/api/x` gate has checked the caller before the handler runs.
 */
export type ExtractHandlerDeps = {
  isConfigured: () => boolean
  consumeRateLimit: typeof consumeRateLimit
  extractStructured: <TRaw>(
    options: ExtractStructuredOptions<TRaw>,
  ) => Promise<StructuredReply<TRaw>>
}

const IMAGE_TOO_LARGE: ExtractError = {
  code: 'image_too_large',
  message: 'That picture is too large to send. Retake it, or choose another picture',
}

/**
 * Its diagnostic names fields the owner never sees, so it goes only to the log.
 */
const INVALID_REQUEST: ExtractError = { code: 'invalid_request', message: INVALID_REQUEST_MESSAGE }

/**
 * Each request meters and makes one model call. The browser picks the phase and call and judges the
 * read; the server prices them and resolves the model from its own chain, so a request cannot pick
 * one.
 */
export function createExtractHandler<TRaw, TPuzzle, TResult, THints extends object>(
  config: ExtractHandlerConfig<TRaw, TPuzzle, TResult, THints>,
): Extraction {
  const { models } = config

  // Built on first use, not at module load: a cold isolate loads every puzzle's handler, and
  // building each schema there would spend the CPU allowance on puzzles it does not read.
  let schemas:
    { provider: Record<string, unknown>; request: z.ZodType<ExtractRequest<THints>> } | undefined
  const schemasOf = (): NonNullable<typeof schemas> => {
    schemas ??= {
      provider: toStrictJsonSchema(config.responseSchema),
      // Data that is not base64 reaches the provider after the admission is spent, accepted to
      // keep a megabyte scan out of the CPU allowance.
      request: z.strictObject({
        data: z
          .string()
          .refine((data) => data.startsWith(JPEG_BASE64_SIGNATURE), 'The image is not a JPEG'),
        hints: config.hintsSchema,
      }),
    }
    return schemas
  }

  async function handle(
    context: APIContext,
    puzzleId: string,
    deps: ExtractHandlerDeps,
  ): Promise<Response> {
    const owner = ownerOf(context.locals)
    const { requestId } = owner
    const startedAt = Date.now()
    const { log, logError } = scopedLog(puzzleId, requestId)
    // `outcome` names the check that refused, which the status cannot.
    const refuse = (
      outcome: string,
      status: number,
      error?: ExtractError,
      fields?: Record<string, unknown>,
      headers?: HeadersInit,
    ): Response => {
      log('done', { outcome, status, ms: elapsedMs(startedAt), ...fields })
      return error
        ? refusalResponse(wireFailure(error), status, headers)
        : new Response(null, { status })
    }

    // In this order so no admission is spent on a request that could never be served.
    if (!deps.isConfigured()) {
      logErrorEvent('vision.not_configured', { requestId, unset: 'OPENAI_API_KEY' })
      return refuse('not_configured', 503, NOT_CONFIGURED)
    }

    if (isDeclaredOver(context.request, MAX_BODY_BYTES)) {
      return refuse('body_too_large', 413, IMAGE_TOO_LARGE, {
        maxBodyBytes: MAX_BODY_BYTES,
        declared: true,
      })
    }

    const search = searchSchema.safeParse(Object.fromEntries(context.url.searchParams))
    if (!search.success) {
      return refuse('invalid_request', 400, INVALID_REQUEST, {
        diagnostic: z.prettifyError(search.error),
      })
    }
    const { phase, call } = search.data
    const model: ChainModel | undefined = models[phase][call]
    if (!model) {
      return refuse('invalid_request', 400, INVALID_REQUEST, {
        diagnostic: `No call ${String(call)} in the ${phase} phase`,
      })
    }

    // `consumeRateLimit` logs its own failures.
    const rateLimit = await deps.consumeRateLimit(owner, admissionsOf(model))
    switch (rateLimit.status) {
      case 'ok': {
        break
      }
      case 'limited': {
        // At least a second, so the header never says to retry immediately.
        const retryAfter = String(Math.max(Math.ceil(rateLimit.retryAfterMs / 1000), 1))
        return refuse(
          'rate_limited',
          429,
          {
            code: 'rate_limited',
            message: 'You have reached the limit on picture reads for now',
          },
          { retryAfterMs: rateLimit.retryAfterMs },
          { 'retry-after': retryAfter },
        )
      }
      case 'unavailable': {
        // Paid work fails closed when metering is unavailable.
        return refuse(
          'rate_limit_unavailable',
          503,
          { code: 'unavailable', message: UNAVAILABLE_MESSAGES[rateLimit.cause] },
          { cause: rateLimit.cause },
        )
      }
      default: {
        const unexpected: never = rateLimit
        return unexpected
      }
    }

    const bodyReadMs = EXTRACT_DEADLINE_MS[phase] - EXTRACT_MIN_WINDOW_MS - elapsedMs(startedAt)
    let requestBody: BoundedText | undefined
    try {
      requestBody = await readBoundedText(context.request.body, MAX_BODY_BYTES, bodyReadMs)
    } catch {
      // A body that broke off part-way leaves nothing to answer.
    }
    // A browser leaving mid-upload cuts the body short, which would read as a stall or bad JSON.
    // As the last await before the response opens, this also keeps a paid call from starting for
    // a browser already gone. Needs `enable_request_signal`.
    if (context.request.signal.aborted) {
      // Nobody receives this, so 499 only labels the log.
      return refuse('client_disconnected', 499)
    }
    if (!requestBody) return refuse('invalid_json', 400, INVALID_REQUEST)
    if (requestBody.status === 'too_large') {
      return refuse('body_too_large', 413, IMAGE_TOO_LARGE, { maxBodyBytes: MAX_BODY_BYTES })
    }
    if (requestBody.status === 'timed_out') {
      // Not 408, which Chromium resends on a reused connection, spending another admission, and
      // not `model_failed`, which would spend a fallback admission on the same stall. The spent
      // admission is not refunded.
      logError('body_timed_out', { bodyReadMs, rateLimitSpent: true })
      return refuse('body_timed_out', 400, {
        code: 'request_timeout',
        message:
          'Sending the picture took so long that there was no time left to read it. Try again',
      })
    }
    let json: unknown
    try {
      json = JSON.parse(requestBody.text)
    } catch {
      return refuse('invalid_json', 400, INVALID_REQUEST)
    }

    const parsedRequest = schemasOf().request.safeParse(json)
    if (!parsedRequest.success) {
      return refuse('invalid_request', 400, INVALID_REQUEST, {
        diagnostic: z.prettifyError(parsedRequest.error),
      })
    }
    const { data, hints } = parsedRequest.data
    const rank = callRank(phase, call)
    const windowMs = EXTRACT_DEADLINE_MS[phase] - elapsedMs(startedAt)

    log('request', {
      phase,
      rank,
      model: modelKey(model),
      maxTokens: MAX_TOKENS,
      approximateBytes: Math.floor((data.length * 3) / 4),
      hints: Object.keys(hints),
    })

    const { provider: schema } = schemasOf()
    const prompt = config.prompt(hints)
    // The schema checked the JPEG signature, so the type is not taken from the request.
    const image = `data:image/jpeg;base64,${data}`

    const read = async (signal: AbortSignal): Promise<CallOutcome<TResult>> => {
      const reply = await deps.extractStructured<TRaw>({
        image,
        schema,
        responseSchema: config.responseSchema,
        prompt,
        model,
        requestId,
        signal,
      })
      if (!reply.ok) return reply
      const parsed = config.parse(reply.data)
      if (!parsed.ok) {
        logError('uninterpretable', {
          rank,
          model: model.id,
          effort: model.effort ?? null,
          message: parsed.message,
        })
        // The diagnostic names rows and cells the user never saw, so it stays in the log.
        return { ok: false, error: UNREADABLE }
      }
      const { puzzle } = parsed
      return { ok: true, result: config.toWire(puzzle), logFields: config.logFields(puzzle) }
    }

    const encoder = new TextEncoder()
    // The browser leaving, as the request signal or the stream's cancellation reports it: the
    // runtime may not propagate one of them.
    const cancelled = new AbortController()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const settle = async (): Promise<void> => {
          const { logFields, ...summary } = await runReadSession<TResult>({
            windowMs,
            signal: AbortSignal.any([context.request.signal, cancelled.signal]),
            read,
            write: (text) => {
              try {
                controller.enqueue(encoder.encode(text))
                return true
              } catch {
                // Closed by the browser leaving.
                return false
              }
            },
            logError,
          })
          try {
            controller.close()
          } catch {
            // Already cancelled by the browser.
          }
          log('done', { ...logFields, ...summary, status: 200 })
        }
        // Keeps the isolate for the final log line after the browser has gone.
        context.locals.cfContext.waitUntil(settle())
      },
      cancel() {
        cancelled.abort()
      },
    })

    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // `no-transform` keeps a proxy from buffering the keepalive whitespace into one response.
        'cache-control': 'private, no-store, no-transform',
      },
    })
  }

  return { models, responseSchema: config.responseSchema, handle }
}

/**
 * The `/api/x/puzzle-solvers/[puzzle]` route, kept out of `src/pages` because a test beside the
 * route would be served as one.
 */
export async function serveExtraction(
  context: APIContext,
  extractions: Readonly<Record<string, Extraction>>,
  deps: ExtractHandlerDeps,
): Promise<Response> {
  const puzzle = context.params.puzzle ?? ''
  // Own keys only, so `__proto__` and the like name no puzzle.
  const extraction = Object.hasOwn(extractions, puzzle) ? extractions[puzzle] : undefined
  if (!extraction) {
    // The page posts to its own puzzle's path, so it predates this deployment.
    logEvent('puzzle-solvers.unknown_puzzle', {
      requestId: ownerOf(context.locals).requestId,
      puzzle: context.params.puzzle,
    })
    return refusalResponse(
      wireFailure({ code: 'invalid_request', message: OUT_OF_DATE_MESSAGE }),
      404,
    )
  }
  return extraction.handle(context, puzzle, deps)
}
