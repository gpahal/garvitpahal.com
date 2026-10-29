import type { PixelImage } from '../capture/pixels'
import type { Capture } from '../capture/rectify'
import type { ExtractOptions, ExtractOutcome, PreparedImage } from '../vision/extract-client'

export type ParseResult<TPuzzle> = { ok: true; puzzle: TPuzzle } | { ok: false; message: string }

export type ReadConfidence = 'trusted' | 'suspect' | 'misread'

export type ReadAssessment = {
  confidence: ReadConfidence
  /**
   * For agreement between configurations; omitted when the read must never be promoted.
   */
  fingerprint?: string
}

/**
 * Only a finished search is evidence of a misread, so `timeout` stays distinct from `unsolvable`. A
 * search that times out after one solution returns it with `isUnique: false`. `solution` is `n * n`
 * entries 1..n, row-major.
 */
export type SolveResult =
  | { status: 'solved'; solution: Uint8Array; isUnique: boolean }
  | { status: 'unsolvable' }
  | { status: 'multiple'; solution: Uint8Array }
  | { status: 'timeout' }

export type SolveOptions = {
  timeoutMs: number
  now?: () => number
}

/**
 * A lowercase noun that reads mid-sentence and takes an `s` in the plural.
 */
export type ReviewUnit = 'cell' | 'cage'

/**
 * Puzzles are immutable values: edits return new objects.
 */
export type PuzzleDefinition<TPuzzle, TId extends string = string> = {
  /**
   * Also its page under `/x/puzzle-solvers/` and its endpoint's path.
   */
  id: TId
  name: string
  blurb: string
  read: (prepared: PreparedImage, options: ExtractOptions) => Promise<ExtractOutcome<TPuzzle>>
  blank: () => TPuzzle
  /**
   * Units the read flagged and the user has not reviewed. Editing a unit reviews it.
   */
  unreviewedCount: (puzzle: TPuzzle) => number
  reviewUnit: ReviewUnit
  reviewNote?: (puzzle: TPuzzle) => string | undefined
  solveBlocker: (puzzle: TPuzzle) => string | undefined
  /**
   * What makes this puzzle's search slow, as sentences with no final full stop.
   */
  timeoutHint: string
}

/**
 * Imports only types from its puzzle's `api.ts`, whose zod schemas would otherwise land in the
 * Worker bundle. The endpoint validates the hints.
 */
export type PuzzleCompute<TPuzzle> = {
  prepare: (capture: Capture) => { pixels: PixelImage; hints: object }
  fingerprint: (puzzle: TPuzzle) => string | undefined
  solve: (puzzle: TPuzzle, options: SolveOptions) => SolveResult
}
