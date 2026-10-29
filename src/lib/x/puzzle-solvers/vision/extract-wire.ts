import * as z from 'zod/mini'

import { failureSchema } from '@/lib/failure'

export type ReadPhase = 'initial' | 'fallback'

/**
 * The site's `Failure` plus `fallback`, which permits a read's paid fallback. Absent means none.
 */
export const readFailureSchema = z.extend(failureSchema, { fallback: z.optional(z.literal(true)) })

export type ReadFailure = z.infer<typeof readFailureSchema>

export type ReadRemedy = Omit<ReadFailure, 'message'>

export const readRefusalSchema = z.object({ error: readFailureSchema })

export type ReadRefusal = z.infer<typeof readRefusalSchema>

/**
 * Calls run in parallel, one request each. `VisionModels` in `server/models.ts` is sized to it.
 */
export const PHASE_CALLS = { initial: 2, fallback: 1 } as const satisfies Record<ReadPhase, number>

/**
 * In the query rather than the body, so the server can price a request before reading the body.
 */
export function extractSearch(phase: ReadPhase, call: number): string {
  return `?${new URLSearchParams({ phase, call: String(call) }).toString()}`
}

export function callRank(phase: ReadPhase, call: number): number {
  return phase === 'initial' ? call : PHASE_CALLS.initial + call
}

/**
 * Counted from when the route starts. The initial phase's is shorter so that the browser's
 * `READ_DEADLINE_MS` still leaves time for the fallback.
 */
export const EXTRACT_DEADLINE_MS = {
  initial: 60_000,
  fallback: 90_000,
} as const satisfies Record<ReadPhase, number>

/**
 * The least time left after metering and upload for which the model call starts. The admission is
 * spent by then, but a shorter window would add a call that cannot finish.
 */
export const EXTRACT_MIN_WINDOW_MS = 20_000

export type ExtractRequest<THints> = {
  /**
   * A JPEG in base64 without a data-URL prefix: every capture path re-encodes to JPEG.
   */
  data: string
  hints: THints
}

type ExtractErrorCode =
  /**
   * A page older than the deployment, which a reload fixes, or a body damaged in transit.
   */
  | 'invalid_request'
  | 'image_too_large'
  | 'rate_limited'
  | 'not_configured'
  | 'unavailable'
  /**
   * Another model call might not repeat it, so it permits the paid fallback.
   */
  | 'model_failed'
  /**
   * Refused without blaming the account or the picture, such as for an unsupported parameter. The
   * fallback's model may take it, but Try again would resend the same requests to the same models.
   */
  | 'model_refused'
  | 'account_rejected'
  | 'model_rejected'
  | 'request_timeout'

export type ExtractError = { code: ExtractErrorCode; message: string }

/**
 * Try again resends the same picture to the same models, so it cannot fix an oversized picture or a
 * provider refusal. A missing key or a refused account keeps Try again, which works once the owner
 * fixes it.
 */
const REMEDIES: Readonly<Record<ExtractErrorCode, ReadRemedy>> = {
  invalid_request: { reload: true, noRetry: true },
  image_too_large: { noRetry: true },
  rate_limited: {},
  not_configured: {},
  unavailable: {},
  model_failed: { fallback: true },
  model_refused: { fallback: true, noRetry: true },
  account_rejected: {},
  model_rejected: { noRetry: true },
  request_timeout: {},
}

export function wireFailure({ code, message }: ExtractError): ReadFailure {
  return { message, ...REMEDIES[code] }
}

/**
 * No verdict: the server does not solve, so the browser ranks and judges. `createWireRead` validates
 * the puzzle's shape.
 */
export const extractReadSchema = z.object({ puzzle: z.unknown() })

export type ExtractRead<TResult> = { puzzle: TResult }

export const SIGN_IN_AGAIN_MESSAGE =
  'Your session has expired. Sign in again in a new tab, then try again'

export const OUT_OF_DATE_MESSAGE = 'This page is out of date. Reload it and try again'

/**
 * Followed by the remedy of a failure a call already met, else by Try again.
 */
export const READ_TIME_LIMIT = 'Reading the picture reached its time limit.'

export const READ_TIME_LIMIT_MESSAGE = `${READ_TIME_LIMIT} Try again`

export const UNREADABLE_MESSAGE =
  'The puzzle could not be read from that picture. Try again, or choose a clearer picture'
