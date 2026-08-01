import type { APIContext } from 'astro'

import { z } from 'zod'

import {
  approximateDecodedBytes,
  extractStructured,
  VisionExtractionError,
} from '@/lib/vision/extract'
import { visionModelsSchema, type VisionModel } from '@/lib/vision/model'
import { elapsedMs, getRequestId, logEvent } from '@/lib/x/log'
import { extractErrorResponse, jsonResponse } from '@/lib/x/response'
import type { ExtractErrorCode } from '@/puzzles/types'

/** Size is checked separately below: it is the one failure with its own status code. */
const extractRequestSchema = z.strictObject({
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  data: z.string().min(1),
  models: visionModelsSchema,
})

export type Interpretation<TResult> =
  | {
      ok: true
      /** The payload returned to the browser. */
      result: TResult
      /**
       * `suspect` escalates to the next model. How a puzzle decides its own read looks wrong is its
       * business - this module only acts on the verdict.
       */
      confidence: 'trusted' | 'suspect'
      logFields?: Record<string, unknown>
    }
  | { ok: false; message: string }

export type ExtractHandlerConfig<TRaw, TResult> = {
  /** Prefixes every log event: `<puzzleId>.request`, `.escalated`, `.read`, `.done`. */
  puzzleId: string
  maxImageBytes: number
  /** JSON Schema handed to the model. */
  schema: Record<string, unknown>
  prompt: string
  /** The model is constrained by `schema`, not trusted: its reply is parsed with this. */
  responseSchema: z.ZodType<TRaw>
  interpret: (raw: TRaw) => Interpretation<TResult>
}

type ReadResult<TResult> =
  | {
      kind: 'ok'
      result: TResult
      confidence: 'trusted' | 'suspect'
      logFields: Record<string, unknown>
    }
  | { kind: 'error'; outcome: string; code: ExtractErrorCode; status: number; message: string }

/** Bad model output rather than a bad request: a stronger model gets another go at all of these. */
const RETRYABLE_OUTCOMES = new Set([
  'extraction_truncated',
  'extraction_empty',
  'extraction_unparseable',
  'uninterpretable',
])

/**
 * A printed puzzle is well-formed, so anything the puzzle calls `suspect` means a misread. Config
 * and upstream failures are excluded: another call cannot fix a missing key, and a retried timeout
 * just doubles the wait.
 */
function shouldEscalate<TResult>(result: ReadResult<TResult>): boolean {
  return result.kind === 'ok'
    ? result.confidence === 'suspect'
    : RETRYABLE_OUTCOMES.has(result.outcome)
}

/**
 * The request envelope every puzzle's extraction endpoint shares: validate, guard the payload size,
 * call the model, escalate through the fallbacks while the read looks wrong, and log the lot under
 * one request id. Everything puzzle-specific arrives through `interpret`.
 */
export function createExtractHandler<TRaw, TResult>(
  config: ExtractHandlerConfig<TRaw, TResult>,
): (context: APIContext) => Promise<Response> {
  const { puzzleId, maxImageBytes } = config

  async function read(
    image: { mediaType: string; data: string },
    model: VisionModel,
    requestId: string,
  ): Promise<ReadResult<TResult>> {
    let raw: TRaw
    try {
      raw = await extractStructured<TRaw>({
        image,
        schema: config.schema,
        responseSchema: config.responseSchema,
        prompt: config.prompt,
        model,
        requestId,
      })
    } catch (error) {
      if (error instanceof VisionExtractionError) {
        // A missing secret is a server misconfiguration, not a bad picture - say so, and use a 5xx
        // that does not imply the upstream model rejected anything.
        return error.reason === 'not_configured'
          ? {
              kind: 'error',
              outcome: 'not_configured',
              code: 'not_configured',
              status: 503,
              message: error.message,
            }
          : {
              kind: 'error',
              outcome: `extraction_${error.reason}`,
              code: 'model_failed',
              status: 502,
              message: error.message,
            }
      }
      return {
        kind: 'error',
        outcome: 'unexpected_error',
        code: 'model_failed',
        status: 502,
        message: 'Could not read the puzzle from that image',
      }
    }

    const interpreted = config.interpret(raw)
    if (!interpreted.ok) {
      return {
        kind: 'error',
        outcome: 'uninterpretable',
        code: 'unparseable',
        status: 422,
        message: interpreted.message,
      }
    }

    const logFields = interpreted.logFields ?? {}
    logEvent(`${puzzleId}.read`, {
      requestId,
      model: model.id,
      effort: model.effort ?? null,
      confidence: interpreted.confidence,
      ...logFields,
    })

    return {
      kind: 'ok',
      result: interpreted.result,
      confidence: interpreted.confidence,
      logFields,
    }
  }

  return async function POST(context: APIContext): Promise<Response> {
    const requestId = getRequestId(context.request)
    const startedAt = Date.now()

    /** Every exit goes through here: `outcome` says which branch ended it, the status cannot. */
    function done(outcome: string, response: Response, fields?: Record<string, unknown>): Response {
      logEvent(`${puzzleId}.done`, {
        requestId,
        outcome,
        status: response.status,
        ms: elapsedMs(startedAt),
        ...fields,
      })
      return response
    }

    /** The one refusal with its own status code, reached from both the header and the payload. */
    function tooLarge(bytes: number): Response {
      return done(
        'image_too_large',
        extractErrorResponse({ code: 'image_too_large', message: 'That image is too large' }, 413),
        { approximateBytes: bytes },
      )
    }

    // Before `json()`, which would otherwise buffer and parse the whole body first. The image
    // dominates the body, so the declared length is a fair proxy for it - but it is only a claim,
    // so this turns away the obviously oversized and the real check still runs below.
    const declaredLength = Number(context.request.headers.get('content-length'))
    if (
      Number.isFinite(declaredLength) &&
      approximateDecodedBytes(declaredLength) > maxImageBytes
    ) {
      return tooLarge(approximateDecodedBytes(declaredLength))
    }

    let json: unknown
    try {
      json = await context.request.json()
    } catch {
      return done(
        'invalid_json',
        extractErrorResponse({ code: 'invalid_request', message: 'Expected a JSON body' }, 400),
      )
    }

    const parsedRequest = extractRequestSchema.safeParse(json)
    if (!parsedRequest.success) {
      const message = z.prettifyError(parsedRequest.error)
      return done(
        'invalid_request',
        extractErrorResponse({ code: 'invalid_request', message }, 400),
        {
          message,
        },
      )
    }
    const { mediaType, data, models } = parsedRequest.data

    // Sized from the encoded length, so an oversized payload is never base64-decoded.
    const approximateBytes = approximateDecodedBytes(data.length)
    if (approximateBytes > maxImageBytes) {
      return tooLarge(approximateBytes)
    }

    logEvent(`${puzzleId}.request`, {
      requestId,
      mediaType,
      approximateBytes,
      primaryModel: models.primary.id,
    })

    const image = { mediaType, data }
    let model = models.primary
    let result = await read(image, model, requestId)

    for (const fallback of models.fallbacks) {
      if (!shouldEscalate(result)) {
        break
      }

      // Effort is logged alongside the id because a chain may hold the same model twice at rising
      // effort, and `from`/`to` alone would then read as a retry of the identical call.
      logEvent(`${puzzleId}.escalated`, {
        requestId,
        from: model.id,
        fromEffort: model.effort ?? null,
        to: fallback.id,
        toEffort: fallback.effort ?? null,
        reason: result.kind === 'ok' ? 'suspect_read' : result.outcome,
      })

      const retried = await read(image, fallback, requestId)
      // A puzzle the user can correct beats an error page, so an earlier read survives a failed retry.
      result = retried.kind === 'ok' || result.kind === 'error' ? retried : result
      model = fallback
    }

    if (result.kind === 'error') {
      return done(
        result.outcome,
        extractErrorResponse({ code: result.code, message: result.message }, result.status),
      )
    }

    // An unverified read is still returned: the review step exists to fix what the model got wrong.
    return done('ok', jsonResponse({ ok: true, puzzle: result.result }, 200), {
      confidence: result.confidence,
      ...result.logFields,
    })
  }
}
