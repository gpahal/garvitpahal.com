// For the type of `Uint8Array.prototype.toBase64`, which the preset's es2025 lib lacks.
/// <reference lib="esnext.typedarrays" />
import type { Failure } from '@/lib/failure'
import { setTimer } from '@/lib/timers'
import type { SetTimer } from '@/lib/timers'

import type { Capture } from '../capture/rectify'
import { WorkerStartError } from '../processing/jobs'
import { OPERATIONS } from '../processing/protocol'
import type { ReadAssessment } from '../puzzles/types'
import { failureOf, UserFacingError } from '../user-facing-error'
import type { ExtractOptions, ExtractOutcome, PreparedImage } from './extract-client'
import { READ_TIME_LIMIT, READ_TIME_LIMIT_MESSAGE, UNREADABLE_MESSAGE } from './extract-wire'
import type { ReadFailure } from './extract-wire'
import { considerRead, createArbitration } from './read-arbitration'
import { READ_DEADLINE_MS, readPhases } from './read-phases'

/**
 * `noRetry` marks a picture whose failure another read would meet too, so the page hides Try again.
 */
export type RetainedPicture = { capture: Capture; prepared?: PreparedImage; noRetry?: true }
export type ReadStage = 'Preparing picture' | 'Reading puzzle' | 'Checking read'
/**
 * `retryAt` is set if any call was asked to wait, however the read ended. `prepared` is kept for Try
 * again to reuse.
 */
export type PictureReadResult<TPuzzle> = ReadEnding<TPuzzle> & {
  retryAt?: number
  prepared?: PreparedImage
}

type ReadEnding<TPuzzle> =
  | { status: 'read' | 'unsolvable'; puzzle: TPuzzle; notice?: Failure }
  | { status: 'failed'; failure: Failure }
  | { status: 'cancelled' }

const READ_STOPPED_MESSAGE = 'Reading the picture stopped unexpectedly. Try again'

/**
 * A read proven unsolvable is a worse guess than a puzzle already on screen, which may carry the
 * owner's corrections, so it replaces nothing.
 */
const MISREAD_KEPT = 'The new read has no solution, so your puzzle was kept.'

export const MISREAD_KEPT_MESSAGE = `${MISREAD_KEPT} Try again, or choose another picture`

export const MISREAD_KEPT_NO_RETRY_MESSAGE = `${MISREAD_KEPT} Choose another picture`

export function pictureAfterRead(
  picture: RetainedPicture,
  result: PictureReadResult<unknown>,
): RetainedPicture {
  const failure =
    result.status === 'failed'
      ? result.failure
      : result.status === 'cancelled'
        ? undefined
        : result.notice
  return failure?.noRetry ? { ...picture, noRetry: true } : picture
}

type PictureReadOptions<TPuzzle> = {
  picture: RetainedPicture
  /**
   * Manual entry and Start over cancel a read, so this holds throughout.
   */
  isPuzzleOnScreen: boolean
  signal: AbortSignal
  prepare: (capture: Capture, signal: AbortSignal) => Promise<PreparedImage>
  read: (request: PreparedImage, options: ExtractOptions) => Promise<ExtractOutcome<TPuzzle>>
  assess: (puzzle: TPuzzle, signal: AbortSignal) => Promise<ReadAssessment>
  onStage: (stage: ReadStage) => void
  now: () => number
  schedule?: SetTimer
}

export const OUTDATED_BROWSER_MESSAGE =
  'This browser cannot process pictures. Update it, or open this website in another browser'

/**
 * `toBase64` sets the floor at Chrome 140, Firefox 133 and Safari 18.2, which all have a Worker
 * `OffscreenCanvas`. The capture pane asks before any picture is chosen, so nothing past it checks
 * again.
 */
export function canReadPictures(): boolean {
  return (
    'any' in AbortSignal &&
    typeof (Uint8Array.prototype as Partial<Uint8Array>).toBase64 === 'function'
  )
}

/**
 * Cancellation is checked after every await, since a collaborator may finish after its signal
 * aborts. Only the result may replace the puzzle on screen.
 */
export async function readPicture<TPuzzle>({
  picture,
  isPuzzleOnScreen,
  signal: parent,
  prepare,
  read,
  assess,
  onStage,
  now,
  schedule = setTimer,
}: PictureReadOptions<TPuzzle>): Promise<PictureReadResult<TPuzzle>> {
  if (parent.aborted) return { status: 'cancelled' }
  const controller = new AbortController()
  const signal = AbortSignal.any([parent, controller.signal])
  let isTimedOut = false
  const cancelDeadline = schedule(() => {
    isTimedOut = true
    controller.abort()
  }, READ_DEADLINE_MS)
  const arbitration = createArbitration<TPuzzle>()
  const deadline = now() + READ_DEADLINE_MS
  let isTrusted = false
  let failure: ReadFailure | undefined
  let isStartFailure = false
  let retryAt: number | undefined
  let request = picture.prepared
  try {
    if (!request) {
      onStage('Preparing picture')
      const image = await prepare(picture.capture, signal)
      signal.throwIfAborted()
      request = image
    }
    onStage('Reading puzzle')
    const prepared = request
    const phases = await readPhases<TPuzzle>({
      deadline,
      now,
      isStopped: () => signal.aborted || isStartFailure,
      // Trusting a read, cancelling or the deadline aborts `signal`, ending every open request.
      read: async (phase, call) => read(prepared, { phase, call, signal }),
      onRead: async (puzzle, rank) => {
        signal.throwIfAborted()
        onStage('Checking read')
        // After a Worker start failure every later assessment would wait out the start limit and
        // fail too, so none is tried and no fallback is bought.
        let assessment: ReadAssessment = { confidence: 'suspect' }
        if (!isStartFailure) {
          try {
            assessment = await assess(puzzle, signal)
          } catch (error) {
            // Short of an abort, the Worker failed, which says nothing about a paid, wire-valid
            // read: keep it unverified, like a timeout.
            if (signal.aborted) throw error
            if (error instanceof WorkerStartError) isStartFailure = true
          }
        }
        signal.throwIfAborted()
        const { isSettled } = considerRead(arbitration, {
          puzzle,
          rank,
          confidence: assessment.confidence,
          fingerprint: assessment.fingerprint,
        })
        if (isSettled) {
          isTrusted = true
          controller.abort()
        } else onStage('Reading puzzle')
      },
    })
    retryAt = phases.retryAt
    // After the abort, a rejection is only how trusting, cancelling or the deadline ended the phase.
    if (phases.rejected && !signal.aborted) throw phases.rejected.error
    if (phases.failure) {
      failure = phases.failure.error
    } else if (phases.skipped) {
      // Any read so far reaches `finishRead`, which shows it or keeps the puzzle on screen.
      failure = {
        message:
          arbitration.best || arbitration.lastResort
            ? 'There was not enough time to read it again. Compare it with the picture'
            : READ_TIME_LIMIT_MESSAGE,
      }
    }
  } catch (error) {
    // Only a message written for the owner is shown; anything else is logged here.
    if (!signal.aborted && !(error instanceof UserFacingError)) console.error(error)
    failure = failureOf(
      error,
      request === undefined ? OPERATIONS.prepare.failure : READ_STOPPED_MESSAGE,
    )
  } finally {
    cancelDeadline()
    // Ends any request still open, such as a sibling a thrown `onRead` left. Below reads only the
    // flags set before this.
    controller.abort()
  }
  const result = finishRead({
    isCancelled: parent.aborted,
    isTrusted,
    isTimedOut,
    isStartFailure,
    failure,
    best: arbitration.best?.puzzle,
    lastResort: arbitration.lastResort?.puzzle,
    isPuzzleOnScreen,
  })
  return { ...result, retryAt, prepared: request }
}

/**
 * `best` is the read arbitration would show, trusted or not; `lastResort` the best proven misread,
 * shown only when nothing else is.
 */
type ReadEnd<TPuzzle> = {
  isCancelled: boolean
  isTrusted: boolean
  isTimedOut: boolean
  isStartFailure: boolean
  failure: ReadFailure | undefined
  best: TPuzzle | undefined
  lastResort: TPuzzle | undefined
  isPuzzleOnScreen: boolean
}

type FailureKind = 'remedied' | 'refused' | 'unfinished' | 'plain' | 'none'

/**
 * A sign-in or reload failure keeps its own words, which say what the page offers. A `noRetry` or
 * `fallback` failure is worded for a picture that produced nothing, which a puzzle on screen would
 * contradict.
 */
function kindOf(failure: ReadFailure | undefined, isTimedOut: boolean): FailureKind {
  if (failure?.signIn || failure?.reload) return 'remedied'
  if (failure?.noRetry) return 'refused'
  if (isTimedOut || failure?.fallback) return 'unfinished'
  return failure ? 'plain' : 'none'
}

type Words = (message: string) => string

const CHECK_UNFINISHED = 'Checking the read could not finish.'

const REFUSED_NOTICE =
  'Checking the read could not finish, and trying again would not help. Compare it with the picture'

/**
 * `read` words the notice beside an untrusted read, which must not look trusted; `kept` a misread
 * that leaves the puzzle on screen; `unsolvable` any notice beside a misread shown for editing,
 * whose banner already asks for a comparison; `timedOut` a timed-out ending with nothing read, and
 * any other such ending keeps the failure's message.
 */
const ENDING_WORDS: Readonly<
  Record<FailureKind, { read: Words; kept: Words; unsolvable?: Words; timedOut: Words }>
> = {
  remedied: {
    read: (message) => `${CHECK_UNFINISHED} ${message}`,
    kept: (message) => `${MISREAD_KEPT} ${message}`,
    unsolvable: (message) => message,
    timedOut: (message) => `${READ_TIME_LIMIT} ${message}`,
  },
  refused: {
    read: () => REFUSED_NOTICE,
    kept: () => MISREAD_KEPT_NO_RETRY_MESSAGE,
    unsolvable: () => REFUSED_NOTICE,
    timedOut: (message) => `${READ_TIME_LIMIT} ${message}`,
  },
  unfinished: {
    read: () => `${CHECK_UNFINISHED} Compare it with the picture, or try again`,
    kept: () => MISREAD_KEPT_MESSAGE,
    timedOut: () => READ_TIME_LIMIT_MESSAGE,
  },
  plain: {
    read: (message) => `${CHECK_UNFINISHED} ${message}`,
    kept: () => MISREAD_KEPT_MESSAGE,
    timedOut: () => READ_TIME_LIMIT_MESSAGE,
  },
  none: {
    read: () => 'This read could not be checked. Compare it with the picture',
    kept: () => MISREAD_KEPT_MESSAGE,
    timedOut: () => READ_TIME_LIMIT_MESSAGE,
  },
}

/**
 * Cancellation beats everything and leaves the screen as it was; a trusted read beats any failure.
 */
export function finishRead<TPuzzle>({
  isCancelled,
  isTrusted,
  isTimedOut,
  isStartFailure,
  failure,
  best,
  lastResort,
  isPuzzleOnScreen,
}: ReadEnd<TPuzzle>): ReadEnding<TPuzzle> {
  if (isCancelled) return { status: 'cancelled' }
  if (isTrusted && best !== undefined) return { status: 'read', puzzle: best }
  if (isStartFailure && best !== undefined) {
    // Fixed only by a reload, which also renews a lapsed sign-in.
    const notice = { reload: true, noRetry: true, message: OPERATIONS.assess.startFailure } as const
    return { status: 'read', puzzle: best, notice }
  }
  const words = ENDING_WORDS[kindOf(failure, isTimedOut)]
  // Not `fallback`, which only `readPhases` acts on.
  const say = (word: Words): Failure => ({
    ...(failure?.signIn && { signIn: true }),
    ...(failure?.reload && { reload: true }),
    ...(failure?.noRetry && { noRetry: true }),
    message: word(failure?.message ?? UNREADABLE_MESSAGE),
  })
  if (best !== undefined) return { status: 'read', puzzle: best, notice: say(words.read) }
  if (lastResort === undefined) {
    return { status: 'failed', failure: say(isTimedOut ? words.timedOut : (message) => message) }
  }
  return isPuzzleOnScreen
    ? { status: 'failed', failure: say(words.kept) }
    : {
        status: 'unsolvable',
        puzzle: lastResort,
        notice: words.unsolvable && say(words.unsolvable),
      }
}
