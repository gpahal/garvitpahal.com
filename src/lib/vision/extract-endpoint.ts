import type { APIContext } from 'astro'

import { z } from 'zod'

import {
  approximateDecodedBytes,
  extractStructured,
  getVisionClient,
  VisionExtractionError,
} from '@/lib/vision/extract'
import { visionModelsSchema, type VisionModel } from '@/lib/vision/model'
import { elapsedMs, getRequestId, logErrorEvent, logEvent } from '@/lib/x/log'
import { extractErrorResponse } from '@/lib/x/response'
import type { ExtractError, ExtractEvent } from '@/puzzles/types'

/**
 * The one hard bound on a request. Nothing else on the server times a read: the SDK timeout is a
 * safety net above this, and the Worker's clock does not advance during synchronous work anyway.
 */
const EXTRACT_DEADLINE_MS = 90_000

/**
A fallback that cannot finish before the deadline is not worth starting.
*/
const FALLBACK_MIN_WINDOW_MS = 20_000

/**
 * The browser drops the connection the moment it has a read it trusts, and its last hedge is often
 * that read. A short pause before firing the fallbacks lets that disconnect arrive first, so the
 * expensive wave is not started and cut off a round trip later.
 */
const FALLBACK_GRACE_MS = 300

export type Interpretation<TResult> =
  | {
      ok: true
      /**
      The payload sent to the browser.
      */
      result: TResult
      logFields?: Record<string, unknown>
    }
  | { ok: false; message: string }

export type ExtractHandlerConfig<TRaw, TResult, THints> = {
  /**
  Prefixes every log event: `<puzzleId>.request`, `.hedge`, `.read`, `.settled`, `.done`.
  */
  puzzleId: string
  maxImageBytes: number
  /**
  JSON Schema handed to the model.
  */
  schema: Record<string, unknown>
  /**
  What the browser may claim to have seen in the picture. Opaque here; the prompt reads it.
  */
  hintsSchema: z.ZodType<THints>
  prompt: (hints: THints) => string
  /**
  The model is constrained by `schema`, not trusted: its reply is parsed with this.
  */
  responseSchema: z.ZodType<TRaw>
  /**
   * Parse only, no solving: this runs on the Worker's CPU budget, which is a few milliseconds. The
   * browser decides whether a read can be trusted.
   */
  interpret: (raw: TRaw) => Interpretation<TResult>
}

type SettleReason = 'exhausted' | 'deadline' | 'client_disconnected'

function modelKey(model: VisionModel): string {
  return `${model.id}@${model.effort ?? 'default'}${model.tier ? `+${model.tier}` : ''}`
}

/**
 * The request envelope every puzzle's extraction endpoint shares: validate, guard the payload size,
 * then stream every read the model chain produces back as NDJSON, in arrival order, and let the
 * browser judge them. Every hedge fires at once; the fallbacks fire only if every hedge has
 * settled and the browser is still listening. Everything puzzle-specific arrives through
 * `prompt` and `interpret`.
 */
export function createExtractHandler<TRaw, TResult, THints>(
  config: ExtractHandlerConfig<TRaw, TResult, THints>,
): (context: APIContext) => Promise<Response> {
  const { puzzleId, maxImageBytes } = config

  /**
  Size is checked separately below: it is the one failure with its own status code.
  */
  const requestSchema = z.strictObject({
    mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    data: z.string().min(1),
    models: visionModelsSchema,
    hints: config.hintsSchema,
  })

  return async function POST(context: APIContext): Promise<Response> {
    const requestId = getRequestId(context.request)
    const startedAt = Date.now()

    /**
    Every early exit goes through here: `outcome` says which check refused it, the status cannot.
    */
    function refuse(
      outcome: string,
      response: Response,
      fields?: Record<string, unknown>,
    ): Response {
      logEvent(`${puzzleId}.done`, {
        requestId,
        outcome,
        status: response.status,
        ms: elapsedMs(startedAt),
        ...fields,
      })
      return response
    }

    /**
    The one refusal with its own status code, reached from both the header and the payload.
    */
    function tooLarge(bytes: number): Response {
      return refuse(
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
      return refuse(
        'invalid_json',
        extractErrorResponse({ code: 'invalid_request', message: 'Expected a JSON body' }, 400),
      )
    }

    const parsedRequest = requestSchema.safeParse(json)
    if (!parsedRequest.success) {
      const message = z.prettifyError(parsedRequest.error)
      return refuse(
        'invalid_request',
        extractErrorResponse({ code: 'invalid_request', message }, 400),
        { message },
      )
    }
    const { mediaType, data, models, hints } = parsedRequest.data

    // Sized from the encoded length, so an oversized payload is never base64-decoded.
    const approximateBytes = approximateDecodedBytes(data.length)
    if (approximateBytes > maxImageBytes) {
      return tooLarge(approximateBytes)
    }

    // Checked before the stream opens: once the body is streaming there is no status code left to
    // send, and a missing secret deserves a 503 rather than an error line.
    try {
      getVisionClient()
    } catch (error) {
      logErrorEvent('vision.not_configured', { requestId })
      return refuse(
        'not_configured',
        extractErrorResponse(
          {
            code: 'not_configured',
            message: error instanceof Error ? error.message : 'The puzzle solver is not configured',
          },
          503,
        ),
      )
    }

    logEvent(`${puzzleId}.request`, {
      requestId,
      mediaType,
      approximateBytes,
      hedges: models.hedges.map(modelKey),
      fallbacks: models.fallbacks.map(modelKey),
      hints: Object.keys(hints as object),
    })

    const prompt = config.prompt(hints)
    const image = { mediaType, data }
    const encoder = new TextEncoder()

    let controller: ReadableStreamDefaultController<Uint8Array>
    let isEnded = false
    let emitted = 0
    let inFlight = 0
    let fired = 0
    let aborted = 0
    let readsOk = 0
    let readsFailed = 0
    let firstEmitMs: number | undefined
    let isFallbacksFired = false
    let lastError: ExtractError | undefined
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined
    let graceTimer: ReturnType<typeof setTimeout> | undefined
    const inFlightAborts = new Set<AbortController>()

    /**
    False once the browser has gone; the session is finished by the time this returns.
    */
    function didEmit(event: ExtractEvent<TResult>): boolean {
      try {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        return true
      } catch {
        finish('client_disconnected')
        return false
      }
    }

    /**
     * The single exit, idempotent: every caller - exhaustion, the deadline, the browser leaving -
     * ends up here exactly once, and a hedge settling afterwards finds `ended` set and does nothing.
     */
    function finish(reason: SettleReason): void {
      if (isEnded) {
        return
      }
      isEnded = true
      clearTimeout(deadlineTimer)
      clearTimeout(graceTimer)
      for (const abort of inFlightAborts) {
        abort.abort()
        aborted++
      }
      inFlightAborts.clear()

      if (reason !== 'client_disconnected') {
        if (emitted === 0) {
          didEmit({
            type: 'error',
            error: lastError ?? {
              code: 'model_failed',
              message: 'The puzzle could not be read in time. Try again',
            },
          })
        }
        didEmit({ type: 'done', ms: elapsedMs(startedAt) })
        try {
          controller.close()
        } catch {
          // Already closed by the browser leaving, which is the other way this ends.
        }
      }

      const fields = {
        requestId,
        reason,
        fired,
        aborted,
        readsOk,
        readsFailed,
        emitted,
        firstEmitMs: firstEmitMs ?? null,
        ms: elapsedMs(startedAt),
      }
      // A browser that leaves after a read is the plan working: it found a read it trusts.
      logEvent(`${puzzleId}.settled`, fields)
      logEvent(`${puzzleId}.done`, {
        ...fields,
        outcome: emitted > 0 ? 'ok' : (lastError?.code ?? 'no_reads'),
        status: 200,
      })
    }

    function onSettled(
      model: VisionModel,
      rank: number,
      readStartedAt: number,
      abort: AbortController,
      outcome: { ok: true; raw: TRaw } | { ok: false; error: unknown },
    ): void {
      inFlightAborts.delete(abort)
      inFlight--

      if (!isEnded) {
        if (outcome.ok) {
          const interpreted = config.interpret(outcome.raw)
          if (interpreted.ok) {
            readsOk++
            const ms = elapsedMs(readStartedAt)
            if (didEmit({ type: 'read', puzzle: interpreted.result, model, rank, ms })) {
              emitted++
              firstEmitMs ??= elapsedMs(startedAt)
              logEvent(`${puzzleId}.read`, {
                requestId,
                rank,
                model: model.id,
                effort: model.effort ?? null,
                tier: model.tier ?? null,
                ms,
                ...interpreted.logFields,
              })
            }
          } else {
            readsFailed++
            lastError = { code: 'unparseable', message: interpreted.message }
            logErrorEvent(`${puzzleId}.uninterpretable`, {
              requestId,
              rank,
              model: model.id,
              effort: model.effort ?? null,
              message: interpreted.message,
            })
          }
        } else if (outcome.error instanceof VisionExtractionError) {
          readsFailed++
          if (outcome.error.reason !== 'aborted') {
            lastError = {
              code: outcome.error.reason === 'not_configured' ? 'not_configured' : 'model_failed',
              message: outcome.error.message,
            }
          }
        } else {
          readsFailed++
          lastError = {
            code: 'model_failed',
            message: 'Could not read the puzzle from that image',
          }
          logErrorEvent(`${puzzleId}.unexpected_error`, {
            requestId,
            rank,
            model: model.id,
            message: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
          })
        }
      }

      if (isEnded || inFlight > 0) {
        return
      }
      // Every hedge has settled and the browser is still here, so it has nothing it trusts yet.
      if (
        !isFallbacksFired &&
        models.fallbacks.length > 0 &&
        EXTRACT_DEADLINE_MS - elapsedMs(startedAt) > FALLBACK_MIN_WINDOW_MS
      ) {
        isFallbacksFired = true
        graceTimer = setTimeout(() => {
          if (!isEnded) {
            fire('fallbacks', models.fallbacks, models.hedges.length)
          }
        }, FALLBACK_GRACE_MS)
        return
      }
      finish('exhausted')
    }

    function fire(
      wave: 'hedges' | 'fallbacks',
      waveModels: Array<VisionModel>,
      rankOffset: number,
    ): void {
      logEvent(`${puzzleId}.hedge`, {
        requestId,
        wave,
        models: waveModels.map(modelKey),
        ms: elapsedMs(startedAt),
      })
      for (const [index, model] of waveModels.entries()) {
        const rank = rankOffset + index
        const abort = new AbortController()
        inFlightAborts.add(abort)
        inFlight++
        fired++
        const readStartedAt = Date.now()
        // Settling is wrapped as well, so a hedge abandoned after the response closed ends in a
        // log line rather than an unhandled rejection.
        const run = async (): Promise<void> => {
          let outcome: { ok: true; raw: TRaw } | { ok: false; error: unknown }
          try {
            const raw = await extractStructured<TRaw>({
              image,
              schema: config.schema,
              responseSchema: config.responseSchema,
              prompt,
              model,
              requestId,
              signal: abort.signal,
            })
            outcome = { ok: true, raw }
          } catch (error) {
            outcome = { ok: false, error }
          }
          try {
            onSettled(model, rank, readStartedAt, abort, outcome)
          } catch (error) {
            logErrorEvent(`${puzzleId}.settle_failed`, {
              requestId,
              rank,
              message: error instanceof Error ? error.message : String(error),
            })
          }
        }
        void run()
      }
    }

    const body = new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController
        // First byte at once, so the edge has a response to forward and never idles the socket.
        didEmit({ type: 'started' })
        deadlineTimer = setTimeout(() => {
          finish('deadline')
        }, EXTRACT_DEADLINE_MS)
        // Best effort: it only fires with the `enable_request_signal` compatibility flag, so
        // `cancel` below is wired as well.
        context.request.signal.addEventListener('abort', () => {
          finish('client_disconnected')
        })
        fire('hedges', models.hedges, 0)
      },
      cancel() {
        finish('client_disconnected')
      },
    })

    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/x-ndjson; charset=utf-8',
        // `no-transform` keeps a proxy from buffering the lines into one response.
        'cache-control': 'private, no-store, no-transform',
      },
    })
  }
}
