import type { ApiRefusal } from '@/lib/access-session'
import { errorText } from '@/lib/server/log'
import { setTimer as realSetTimer } from '@/lib/timers'
import type { SetTimer } from '@/lib/timers'

import { READ_TIME_LIMIT_MESSAGE, wireFailure } from '../extract-wire'
import type { ExtractError, ExtractRead } from '../extract-wire'
import { UNREADABLE } from './openai-exchange'

/**
 * A proxy or browser may drop a connection silent for most of the deadline, and a failed write is
 * how a browser that left is noticed.
 */
export const KEEPALIVE_MS = 15_000

const KEEPALIVE = '\n'

/**
 * Another model, or the fallback's longer effort and window, may finish.
 */
const READ_TIMEOUT: ExtractError = {
  code: 'model_failed',
  message: READ_TIME_LIMIT_MESSAGE,
}

export type CallOutcome<TResult> =
  | {
      ok: true
      result: TResult
      logFields?: Record<string, unknown>
    }
  | { ok: false; error: ExtractError }

type ReadSessionOptions<TResult> = {
  windowMs: number
  signal: AbortSignal
  /**
   * Must reject once its signal aborts. A rejection while it still runs is logged and sent as an
   * unusable reply.
   */
  read: (signal: AbortSignal) => Promise<CallOutcome<TResult>>
  /**
   * False once the browser has gone, which ends the session as a disconnect.
   */
  write: (text: string) => boolean
  logError: (event: string, fields: Record<string, unknown>) => void
  now?: () => number
  setTimer?: SetTimer
}

type ReadSessionSummary = {
  /**
   * `ok`, the code of the error sent or `client_disconnected` when nothing could be.
   */
  outcome: string
  reason: 'settled' | 'deadline' | 'client_disconnected'
  ms: number
  logFields?: Record<string, unknown>
}

/**
 * Keeps the response busy with whitespace while the call runs, then sends one JSON body. At the
 * deadline a timeout replaces the call; the browser leaving cuts it off and sends nothing.
 */
export async function runReadSession<TResult>({
  windowMs,
  signal,
  read,
  write,
  logError,
  now = Date.now,
  setTimer = realSetTimer,
}: ReadSessionOptions<TResult>): Promise<ReadSessionSummary> {
  const startedAt = now()
  const controller = new AbortController()
  // A property, since the closures that set it are invisible to narrowing.
  const ending: { reason: ReadSessionSummary['reason'] } = { reason: 'settled' }
  const end = (reason: ReadSessionSummary['reason']): void => {
    if (controller.signal.aborted) return
    ending.reason = reason
    controller.abort()
  }
  const didWrite = (text: string): boolean => {
    if (write(text)) return true
    end('client_disconnected')
    return false
  }
  const onLeave = (): void => {
    end('client_disconnected')
  }
  signal.addEventListener('abort', onLeave)
  // An already-aborted signal never notifies a new listener.
  if (signal.aborted) end('client_disconnected')

  let outcome: CallOutcome<TResult> | undefined
  // First byte at once, so the edge has a response to forward.
  if (!signal.aborted && didWrite(KEEPALIVE)) {
    const cancelDeadline = setTimer(() => {
      end('deadline')
    }, windowMs)
    let cancelKeepalive = (): void => undefined
    const keepAlive = (): void => {
      cancelKeepalive = setTimer(() => {
        if (didWrite(KEEPALIVE)) keepAlive()
      }, KEEPALIVE_MS)
    }
    keepAlive()
    try {
      outcome = await read(controller.signal)
    } catch (error) {
      if (!controller.signal.aborted) {
        logError('unexpected_error', { message: errorText(error) })
        outcome = { ok: false, error: UNREADABLE }
      }
    }
    cancelDeadline()
    cancelKeepalive()
  }
  signal.removeEventListener('abort', onLeave)

  let sent: { body: ExtractRead<TResult> | ApiRefusal; outcome: string } | undefined
  if (outcome?.ok) sent = { body: { puzzle: outcome.result }, outcome: 'ok' }
  else {
    const error = outcome?.error ?? (ending.reason === 'deadline' ? READ_TIMEOUT : undefined)
    if (error) sent = { body: { error: wireFailure(error) }, outcome: error.code }
  }
  const logFields = outcome?.ok ? outcome.logFields : undefined
  return {
    ...(sent && didWrite(JSON.stringify(sent.body))
      ? { outcome: sent.outcome, reason: ending.reason }
      : { outcome: 'client_disconnected', reason: 'client_disconnected' as const }),
    ms: now() - startedAt,
    ...(logFields && { logFields }),
  }
}
