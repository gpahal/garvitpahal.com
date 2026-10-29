import type { Failure } from '@/lib/failure'

import type { SolveResult } from './puzzles/types'
import type { PreparedImage } from './vision/extract-client'
import { laterWait } from './vision/read-phases'
import { pictureAfterRead } from './vision/read-picture'
import type { PictureReadResult, ReadStage, RetainedPicture } from './vision/read-picture'

/**
 * Decides what a bad solve most likely means.
 */
export type PuzzleOrigin = 'read' | 'manual'

/**
 * `isRetry` lets Try again show it is working, since the stage line at the top is out of sight
 * under a long puzzle.
 */
type Activity =
  | { kind: 'idle' }
  | { kind: 'reading'; stage?: ReadStage; startedAt: number; isRetry: boolean }
  | { kind: 'solving' }

/**
 * One-step undo. The previous puzzle keeps its notice, so undoing back to an unverified read brings
 * the notice back.
 */
type PuzzleHistory<T> = {
  puzzle: T | undefined
  previous?: { puzzle: T; isDirty: boolean; notice?: Failure }
  isDirty: boolean
}

/**
 * Outlives its Cancel: which picture stays is settled only once `readPicture` returns.
 */
type PendingRead = { token: number; picture: RetainedPicture }

export type WorkspaceState<T> = {
  history: PuzzleHistory<T>
  origin: PuzzleOrigin
  /**
   * Edits leave it set; Solve, Start over and manual entry clear it.
   */
  isReviewPending: boolean
  /**
   * Bumped whenever the editor must remount.
   */
  readId: number
  editorBlocker?: string
  isChoosing: boolean
  activity: Activity
  read?: PendingRead
  error?: Failure
  /**
   * About an unverified read. Unlike `error` it lasts as long as the puzzle: an edit or another
   * puzzle shown ends it, and undo restores it.
   */
  notice?: Failure
  /**
   * The picture the puzzle on screen was read from, else the last one tried.
   */
  retained?: RetainedPicture
  /**
   * A newer picture whose read produced nothing, kept for Try again.
   */
  unread?: RetainedPicture
  solveResult?: SolveResult
  /**
   * Outlives the message that reported it, which an edit or Start over clears: the wait and the
   * controls it disables still hold.
   */
  retryAt?: number
}

/**
 * An event carrying the `token` of a replaced read changes nothing but `retryAt`. An event that ends
 * the job on screen is dispatched with the abort that stops it (`usePuzzleProcessing`).
 */
export type WorkspaceEvent<T> =
  | { type: 'readStarted'; token: number; picture: RetainedPicture; isRetry: boolean; now: number }
  | { type: 'stageChanged'; token: number; stage: ReadStage }
  | { type: 'readEnded'; token: number; result: PictureReadResult<T> }
  | { type: 'solveStarted' }
  | { type: 'solveEnded'; result: SolveResult }
  | { type: 'solveFailed'; failure: Failure }
  | { type: 'cancelled' }
  | { type: 'edited'; puzzle: T; isContinuingEdit?: boolean }
  | { type: 'undone' }
  | { type: 'blockerChanged'; blocker: string | undefined }
  | { type: 'manualEntered'; puzzle: T }
  | { type: 'reset' }
  | { type: 'choosePicture' }
  | { type: 'keepCurrent' }
  | { type: 'waitElapsed' }
  | { type: 'backToEditing' }

const IDLE: Activity = { kind: 'idle' }

/**
 * Keeps the image the read sent, so Try again need not prepare it again.
 */
function withPrepared(
  picture: RetainedPicture,
  prepared: PreparedImage | undefined,
): RetainedPicture {
  return prepared === undefined || prepared === picture.prepared
    ? picture
    : { capture: picture.capture, prepared }
}

/**
 * `notice` is that of the puzzle being replaced, kept for undo.
 */
function editPuzzle<T>(
  history: PuzzleHistory<T>,
  puzzle: T,
  notice: Failure | undefined,
  isContinuingEdit = false,
): PuzzleHistory<T> {
  if (isContinuingEdit && history.previous) {
    return { ...history, puzzle, isDirty: true }
  }
  return {
    puzzle,
    isDirty: true,
    previous:
      history.puzzle === undefined
        ? undefined
        : { puzzle: history.puzzle, isDirty: history.isDirty, notice },
  }
}

export function initialWorkspaceState<T>(): WorkspaceState<T> {
  return {
    history: { puzzle: undefined, isDirty: false },
    origin: 'read',
    isReviewPending: false,
    readId: 0,
    isChoosing: false,
    activity: IDLE,
  }
}

function shown<T>(state: WorkspaceState<T>, puzzle: T, origin: PuzzleOrigin): WorkspaceState<T> {
  return {
    ...state,
    history: { puzzle, isDirty: false },
    origin,
    isReviewPending: origin === 'read',
    readId: state.readId + 1,
    solveResult: undefined,
    editorBlocker: undefined,
    activity: IDLE,
    error: undefined,
  }
}

function afterReadEnded<T>(
  state: WorkspaceState<T>,
  event: Extract<WorkspaceEvent<T>, { type: 'readEnded' }>,
): WorkspaceState<T> {
  const { read } = state
  const { result } = event
  // A replaced read still reports its wait, which holds whatever the owner has done since.
  const retryAt = laterWait(state.retryAt, result.retryAt)
  if (read?.token !== event.token) {
    return retryAt === state.retryAt ? state : { ...state, retryAt }
  }
  const picture = pictureAfterRead(withPrepared(read.picture, result.prepared), result)
  if (result.status === 'read' || result.status === 'unsolvable') {
    // A read without a notice was trusted. An unsolvable one shows the unsolvable result instead.
    return {
      ...shown(state, result.puzzle, 'read'),
      read: undefined,
      retained: picture,
      unread: undefined,
      notice: result.notice,
      solveResult: result.status === 'unsolvable' ? { status: 'unsolvable' } : undefined,
      retryAt,
    }
  }
  // The puzzle on screen stays. A picture that produced nothing becomes the reference only when
  // no other is kept or it is that one read again.
  const isReference =
    state.retained === undefined || read.picture.capture === state.retained.capture
  const next: WorkspaceState<T> = {
    ...state,
    ...(isReference ? { retained: picture, unread: undefined } : { unread: picture }),
    read: undefined,
    retryAt,
  }
  // Whatever cancelled the read has already ended the job on screen.
  return result.status === 'failed' ? { ...next, activity: IDLE, error: result.failure } : next
}

/**
 * Reads and solves share one cancellation: starting either, and most other actions, ends the job
 * on screen.
 */
export function reduceWorkspace<T>(
  state: WorkspaceState<T>,
  event: WorkspaceEvent<T>,
): WorkspaceState<T> {
  switch (event.type) {
    case 'readStarted': {
      return {
        ...state,
        isChoosing: false,
        readId: state.readId + 1,
        editorBlocker: undefined,
        activity: { kind: 'reading', startedAt: event.now, isRetry: event.isRetry },
        error: undefined,
        solveResult: undefined,
        read: { token: event.token, picture: event.picture },
        // Try again on the unread picture keeps it, so the pressed control stays while it reads.
        unread: event.picture === state.unread ? state.unread : undefined,
      }
    }
    case 'stageChanged': {
      return state.read?.token === event.token && state.activity.kind === 'reading'
        ? { ...state, activity: { ...state.activity, stage: event.stage } }
        : state
    }
    case 'readEnded': {
      return afterReadEnded(state, event)
    }
    case 'solveStarted': {
      return {
        ...state,
        isReviewPending: false,
        activity: { kind: 'solving' },
        error: undefined,
        solveResult: undefined,
      }
    }
    case 'solveEnded': {
      return { ...state, activity: IDLE, solveResult: event.result }
    }
    case 'solveFailed': {
      return { ...state, activity: IDLE, error: event.failure }
    }
    case 'cancelled': {
      return { ...state, activity: IDLE }
    }
    case 'edited': {
      return {
        ...state,
        activity: IDLE,
        error: undefined,
        notice: undefined,
        history: editPuzzle(state.history, event.puzzle, state.notice, event.isContinuingEdit),
        solveResult: undefined,
      }
    }
    case 'undone': {
      const { previous } = state.history
      if (!previous) return state
      const { notice, ...restored } = previous
      return {
        ...state,
        activity: IDLE,
        history: restored,
        notice,
        readId: state.readId + 1,
        editorBlocker: undefined,
        solveResult: undefined,
      }
    }
    case 'blockerChanged': {
      // A half-finished edit cancels the job on screen: see `onBlockerChange`.
      const activity = event.blocker === undefined ? state.activity : IDLE
      return event.blocker === state.editorBlocker && activity === state.activity
        ? state
        : { ...state, editorBlocker: event.blocker, activity }
    }
    case 'manualEntered': {
      return { ...shown(state, event.puzzle, 'manual'), notice: undefined }
    }
    case 'reset': {
      return { ...initialWorkspaceState<T>(), retryAt: state.retryAt }
    }
    case 'choosePicture': {
      return { ...state, activity: IDLE, isChoosing: true }
    }
    case 'keepCurrent': {
      return { ...state, isChoosing: false }
    }
    case 'waitElapsed': {
      return { ...state, retryAt: undefined }
    }
    case 'backToEditing': {
      return { ...state, solveResult: undefined }
    }
  }
}
