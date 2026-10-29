import { ACCESS_FETCH_INIT, isAccessSessionExpired } from '@/lib/access-session'

import {
  extractReadSchema,
  extractSearch,
  OUT_OF_DATE_MESSAGE,
  readRefusalSchema,
  SIGN_IN_AGAIN_MESSAGE,
} from './extract-wire'
import type { ExtractRequest, ReadFailure, ReadPhase } from './extract-wire'

/**
 * `retryAt` is fixed on the `Date.now()` clock when the 429 arrives, so the wait does not grow while
 * the read's other calls finish.
 */
export type ExtractFailure = { ok: false; error: ReadFailure; retryAt?: number }

export type ExtractOutcome<TPuzzle> = ExtractFailure | { ok: true; puzzle: TPuzzle }

export type ExtractOptions = {
  /**
   * The only deadline. Aborting also cuts off the server's model call where the runtime reports the
   * disconnect.
   */
  signal: AbortSignal
  phase: ReadPhase
  call: number
}

function refusalOutcome(error: ReadFailure, response: Response, now: () => number): ExtractFailure {
  if (response.status !== 429) return { ok: false, error }
  const retryAfterS = Number(response.headers.get('retry-after'))
  return Number.isFinite(retryAfterS) && retryAfterS > 0
    ? { ok: false, error, retryAt: now() + retryAfterS * 1000 }
    : { ok: false, error }
}

export type PreparedImage = {
  image: string
  hints: object
}

type WireSchema<TWire> = {
  safeParse: (value: unknown) => { success: true; data: TWire } | { success: false }
}

export function createWireRead<TWire, TPuzzle>(
  puzzleId: string,
  wireSchema: WireSchema<TWire>,
  fromWire: (wire: TWire) => TPuzzle,
  fetchFn: typeof fetch = async (input, init) => fetch(input, init),
  now: () => number = Date.now,
): (prepared: PreparedImage, options: ExtractOptions) => Promise<ExtractOutcome<TPuzzle>> {
  return async (prepared, options) => {
    const outcome = await requestRead(`/api/x/puzzle-solvers/${puzzleId}`, prepared, options, {
      fetchFn,
      now,
    })
    if (!outcome.ok) return outcome
    const parsed = wireSchema.safeParse(outcome.puzzle)
    return parsed.success ? { ok: true, puzzle: fromWire(parsed.data) } : OUT_OF_DATE
  }
}

/**
 * Keeps network failure, an expired session and an incompatible response distinct, since retaking
 * the picture fixes none. The caller's abort rejects.
 */
async function requestRead(
  path: string,
  request: PreparedImage,
  { signal, phase, call }: ExtractOptions,
  { fetchFn, now }: { fetchFn: typeof fetch; now: () => number },
): Promise<ExtractOutcome<unknown>> {
  let response: Response
  try {
    response = await fetchFn(`${path}${extractSearch(phase, call)}`, {
      ...ACCESS_FETCH_INIT,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({
        data: request.image,
        hints: request.hints,
      } satisfies ExtractRequest<object>),
    })
  } catch (error) {
    if (signal.aborted) throw error
    return failure({
      message: "Cannot reach the server. Check this device's internet connection, then try again",
    })
  }

  if (isAccessSessionExpired(response)) {
    return failure({ message: SIGN_IN_AGAIN_MESSAGE, signIn: true })
  }

  // This site's own Worker answers with tens of kilobytes at most, so the body is not bounded.
  let text: string
  try {
    text = await response.text()
  } catch (error) {
    if (signal.aborted) throw error
    return CONNECTION_DROPPED
  }

  let json: unknown
  try {
    // Skips the keepalive whitespace in front of the body.
    json = JSON.parse(text)
  } catch {
    // Under a 200, the connection dropped mid-body. Otherwise a failing server, such as
    // Cloudflare's error 1102 page for a Worker over its CPU limit, which may pass.
    if (response.ok) return CONNECTION_DROPPED
    return response.status >= 500 ? SERVER_FAILED : UNREADABLE_RESPONSE
  }
  const refusal = readRefusalSchema.safeParse(json)
  if (refusal.success) return refusalOutcome(refusal.data.error, response, now)
  if (!response.ok) return UNREADABLE_RESPONSE
  const read = extractReadSchema.safeParse(json)
  return read.success ? { ok: true, puzzle: read.data.puzzle } : OUT_OF_DATE
}

function failure(error: ReadFailure): ExtractFailure {
  return { ok: false, error }
}

/**
 * Neutral about what was delivered: `read-picture.ts` adds context when a read is shown. None
 * permits the fallback, since a transport failure says nothing another model could fix.
 */
const CONNECTION_DROPPED = failure({ message: 'The connection dropped. Try again' })
const UNREADABLE_RESPONSE = failure({
  message: "The server's answer could not be read. Try again",
})
const SERVER_FAILED = failure({
  message: 'The server ran into a problem while reading the picture. Try again shortly',
})
/**
 * From an endpoint newer than the page, so only a reload fixes it; any read already delivered stays.
 */
const OUT_OF_DATE = failure({ message: OUT_OF_DATE_MESSAGE, reload: true, noRetry: true })
