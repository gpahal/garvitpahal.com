import type { Failure } from '@/lib/failure'

import type { PixelImage } from '../capture/pixels'
import type { Quad } from '../capture/quad'
import type { Capture } from '../capture/rectify'
import type { PuzzleId, PuzzleOf } from '../puzzles/registry'
import type { ReadAssessment, SolveResult } from '../puzzles/types'
import type { PreparedImage } from '../vision/extract-client'

export type Operations<TId extends PuzzleId = PuzzleId> = {
  decode: { input: { source: Blob }; output: PixelImage }
  detect: {
    input: { image: PixelImage }
    output: Quad | undefined
  }
  prepare: {
    input: { puzzleId: TId; capture: Capture }
    output: PreparedImage
  }
  assess: { input: { puzzleId: TId; puzzle: PuzzleOf<NoInfer<TId>> }; output: ReadAssessment }
  solve: {
    input: { puzzleId: TId; puzzle: PuzzleOf<NoInfer<TId>> }
    output: SolveResult
  }
}
export type Operation = keyof Operations
type PuzzleJob<TId extends PuzzleId> = {
  [K in Operation]: { id: number; operation: K; data: Operations<TId>[K]['input'] }
}[Operation]
export type Job = { [TId in PuzzleId]: PuzzleJob<TId> }[PuzzleId]
export type JobReply = { id: number } & (
  { ok: true; result: unknown } | { ok: false; failure: Failure }
)
/**
 * `started` starts the compute budget; a crash or time limit before it is a `WorkerStartError`.
 */
export type WorkerMessage = JobReply | { type: 'started'; id: number }
const PROCESS_TIMEOUT_MS = 15_000
const WORKER_START_TIMEOUT_MS = 15_000

const DETECT_FAILURE = 'The grid could not be found'

const START_FAILURES = {
  picture: 'This browser could not start picture processing. Reload the page',
  compute: 'This browser could not start solving. Reload the page',
} as const

/**
 * `limitMs` runs from the call: an image job's whole allowance, Worker startup included, or for a
 * job with `budgetMs` the time to start, after which the solver stops itself at the budget.
 * `onTimeout` is a result where a stall proves nothing (assess) or is a timeout (solve). `failure`
 * is worded for the controls on screen when it shows.
 */
export const OPERATIONS = {
  decode: {
    limitMs: PROCESS_TIMEOUT_MS,
    onTimeout: { message: 'Loading the picture reached its time limit. Choose another picture' },
    failure: 'That picture could not be opened. Choose another picture',
    startFailure: START_FAILURES.picture,
  },
  detect: {
    limitMs: PROCESS_TIMEOUT_MS,
    onTimeout: { message: DETECT_FAILURE },
    // Never shown: the review step falls back to manual corners.
    failure: DETECT_FAILURE,
    startFailure: START_FAILURES.picture,
  },
  prepare: {
    limitMs: PROCESS_TIMEOUT_MS,
    onTimeout: {
      message: 'Preparing the picture reached its time limit. Try again, or choose another picture',
    },
    failure: 'Preparing the picture stopped unexpectedly. Try again, or choose another picture',
    startFailure: START_FAILURES.picture,
  },
  assess: {
    limitMs: WORKER_START_TIMEOUT_MS,
    budgetMs: 2000,
    onTimeout: { result: { confidence: 'suspect' } },
    // Never shown: a read whose assessment fails is kept, unverified (`readPicture`).
    failure: 'Checking the read stopped unexpectedly. Try again',
    startFailure: START_FAILURES.compute,
  },
  solve: {
    limitMs: WORKER_START_TIMEOUT_MS,
    budgetMs: 3000,
    onTimeout: { result: { status: 'timeout' } },
    failure: 'Solving stopped unexpectedly. Press Solve to try again',
    startFailure: START_FAILURES.compute,
  },
} as const satisfies { [K in Operation]: OperationPolicy<Operations[K]['output']> }

type OperationPolicy<TOutput> = {
  limitMs: number
  budgetMs?: number
  onTimeout: { message: string } | { result: TOutput }
  failure: string
  startFailure: string
}
