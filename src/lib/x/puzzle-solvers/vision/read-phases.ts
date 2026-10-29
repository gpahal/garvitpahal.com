import type { ExtractFailure, ExtractOutcome } from './extract-client'
import { callRank, EXTRACT_MIN_WINDOW_MS, PHASE_CALLS } from './extract-wire'
import type { ReadPhase } from './extract-wire'

/**
 * Covers preparation, both phases and assessment, so it cuts off a fallback started late before its
 * server window ends.
 */
export const READ_DEADLINE_MS = 150_000

/**
 * For upload and metering before the model call. It avoids marginal admissions, but a slower request
 * can still be refused.
 */
const ADMISSION_ALLOWANCE_MS = 5000

/**
 * A read the server finishes must still reach the browser, and be assessed, before the deadline.
 */
const DELIVERY_ALLOWANCE_MS = 5000

/**
 * Below it the server would refuse the call after metering or the deadline would cut it off, so the
 * admission would buy nothing.
 */
const PHASE_MIN_MS = EXTRACT_MIN_WINDOW_MS + ADMISSION_ALLOWANCE_MS + DELIVERY_ALLOWANCE_MS

/**
 * `failure` is the last phase's, except that an initial `noRetry` failure is kept unless the fallback
 * was stopped or also met a `noRetry` failure, so the page offers no retry that buys the same
 * refusals. `rejected` is the caller's abort or an unexpected fault; the requests still open are
 * left to that abort.
 */
type PhasesResult = {
  failure?: ExtractFailure
  skipped?: 'fallback'
  retryAt?: number
  rejected?: { error: unknown }
}

type PhaseOptions<TPuzzle> = {
  read: (phase: ReadPhase, call: number) => Promise<ExtractOutcome<TPuzzle>>
  /**
   * Awaited before the next outcome is taken, so reads are judged one at a time in arrival order and
   * the fallback decision sees every verdict.
   */
  onRead: (puzzle: TPuzzle, rank: number) => Promise<void>
}

/**
 * The initial phase, then the fallback only if every initial failure is one another model may
 * recover from and nothing stopped the read.
 */
export async function readPhases<TPuzzle>(
  options: PhaseOptions<TPuzzle> & {
    deadline: number
    now: () => number
    isStopped: () => boolean
  },
): Promise<PhasesResult> {
  if (options.isStopped()) return {}
  const failures: Array<ExtractFailure> = []
  const end = ({ failure, skipped, rejected }: Omit<PhasesResult, 'retryAt'>): PhasesResult => ({
    // Once the read is cut short, no read excuses a failure: only the calls' failures can still
    // name a remedy.
    failure: rejected ? chooseFailure(failures, false) : failure,
    skipped,
    rejected,
    retryAt: latestWait(failures),
  })
  const initial = await runPhase('initial', options, failures)
  if (initial.rejected || options.isStopped()) return end(initial)
  // An absent `fallback` permits none.
  if (initial.failure && !initial.failure.error.fallback) return end(initial)
  if (Math.floor(options.deadline - options.now()) <= PHASE_MIN_MS) {
    return end({ ...initial, skipped: 'fallback' })
  }
  const fallback = await runPhase('fallback', options, failures)
  if (fallback.rejected) return end(fallback)
  const shouldKeepRefusal =
    initial.failure?.error.noRetry === true &&
    (fallback.failure ? !fallback.failure.error.noRetry : !options.isStopped())
  return end(shouldKeepRefusal ? initial : fallback)
}

export function laterWait(a: number | undefined, b: number | undefined): number | undefined {
  return a === undefined ? b : b === undefined ? a : Math.max(a, b)
}

function latestWait(failures: Array<ExtractFailure>): number | undefined {
  let latest: number | undefined
  for (const { retryAt } of failures) latest = laterWait(latest, retryAt)
  return latest
}

/**
 * An unrecoverable failure wins even beside a read, so no fallback is bought to meet it again; a
 * recoverable one counts only when nothing was read. A transport failure is unrecoverable.
 */
function chooseFailure(
  failures: Array<ExtractFailure>,
  hasRead: boolean,
): ExtractFailure | undefined {
  return failures.find((failure) => !failure.error.fallback) ?? (hasRead ? undefined : failures[0])
}

async function runPhase<TPuzzle>(
  phase: ReadPhase,
  { read, onRead }: PhaseOptions<TPuzzle>,
  failures: Array<ExtractFailure>,
): Promise<Pick<PhasesResult, 'failure' | 'rejected'>> {
  const request = async (call: number): Promise<[number, ExtractOutcome<TPuzzle>]> => [
    call,
    await read(phase, call),
  ]
  const pending = new Map<number, Promise<[number, ExtractOutcome<TPuzzle>]>>()
  for (let call = 0; call < PHASE_CALLS[phase]; call++) pending.set(call, request(call))
  const first = failures.length
  let delivered = 0
  try {
    while (pending.size > 0) {
      // Racing every pending call leaves none that rejects after the phase ended unhandled.
      const [call, outcome] = await Promise.race(pending.values())
      pending.delete(call)
      if (outcome.ok) {
        await onRead(outcome.puzzle, callRank(phase, call))
        delivered++
      } else {
        failures.push(outcome)
      }
    }
  } catch (error) {
    return { rejected: { error } }
  }
  return { failure: chooseFailure(failures.slice(first), delivered > 0) }
}
