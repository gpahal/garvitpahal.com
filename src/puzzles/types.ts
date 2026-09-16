import type { Capture } from '@/lib/capture/rectify'
import type { VisionModel } from '@/lib/vision/model'

export type ExtractErrorCode =
  | 'invalid_request'
  | 'image_too_large'
  | 'not_configured'
  | 'model_failed'
  | 'unparseable'
  | 'network'

export type ExtractError = {
  code: ExtractErrorCode
  message: string
}

/**
 * One line of the extraction stream. Shared by the endpoint that writes it and the client that
 * reads it, so the compiler checks a single contract. `read` carries every read that parsed, in
 * arrival order, with no verdict: the server does not solve, so the browser ranks and judges.
 */
export type ExtractEvent<TPuzzle> =
  | { type: 'started' }
  | {
      type: 'read'
      puzzle: TPuzzle
      model: VisionModel
      /**
      Position in the puzzle's chain, hedges then fallbacks. Higher outranks lower.
      */
      rank: number
      ms: number
    }
  | { type: 'error'; error: ExtractError }
  | { type: 'done'; ms: number }

/**
How the stream ended. Reads were delivered along the way, so success carries nothing.
*/
export type ExtractOutcome = { ok: true } | { ok: false; error: ExtractError }

export type ExtractReadMeta = {
  model: VisionModel
  rank: number
}

export type ExtractOptions<TPuzzle> = {
  /**
  Aborting cancels the request, and the server cuts off every model call behind it.
  */
  signal: AbortSignal
  onRead: (puzzle: TPuzzle, meta: ExtractReadMeta) => void
}

/**
 * The browser's verdict on one read. `trusted` is shown as final; `suspect` is shown while a
 * better read is awaited; `misread` is proven wrong and only ever shown as a last resort.
 */
export type ReadConfidence = 'trusted' | 'suspect' | 'misread'

export type ReadAssessment = {
  confidence: ReadConfidence
  /**
   * Identity of what was read, for consensus: two `suspect` reads from different models with the
   * same fingerprint are as good as a trusted one. Left out when the read must never be trusted
   * that way, such as one whose parts contradict each other.
   */
  fingerprint?: string
}

/**
 * `unsolvable` and `multiple` are the oracle that makes extraction from a picture trustworthy without any
 * computer-vision preprocessing: a well-formed puzzle has exactly one solution, so either result
 * means the puzzle was read wrong rather than that it is hard.
 *
 * `isUnique` is what keeps that oracle honest. A search that runs out of time after finding one
 * solution has not ruled out a second, so `solved` alone would quietly claim a proof it never got.
 */
export type SolveResult<TSolution> =
  | { status: 'solved'; solution: TSolution; isUnique: boolean }
  | { status: 'unsolvable' }
  | { status: 'multiple'; solution: TSolution }
  | { status: 'timeout' }

export type SolveOptions = {
  timeoutMs: number
}

/**
 * Everything a puzzle type must provide. Kept free of React and of the vision SDK so the same
 * module is safe to import from both the browser island and a server endpoint - and free of any
 * shape at all, so the next puzzle is not obliged to be a grid.
 *
 * `prepare` turns the capture - the frame and where the grid is in it - into whatever the puzzle
 * wants to send: the crop or the whole picture, encoded, plus any facts it measured. `extract`
 * consumes exactly that, so `TPrepared` is the puzzle's own business and the workspace only
 * passes it through. `assess` is the oracle: it runs
 * in the browser, where the solver has a real clock and already runs for user-initiated solves.
 * `solve` is pure and isomorphic, so re-solving after a user edit costs nothing.
 */
export type PuzzleDefinition<TPuzzle, TSolution, TPrepared> = {
  id: string
  name: string
  blurb: string
  prepare: (capture: Capture) => Promise<TPrepared>
  extract: (prepared: TPrepared, options: ExtractOptions<TPuzzle>) => Promise<ExtractOutcome>
  assess: (puzzle: TPuzzle) => ReadAssessment
  solve: (puzzle: TPuzzle, options: SolveOptions) => SolveResult<TSolution>
  blank: () => TPuzzle
  /**
   * How many parts the model was unsure about and the user has not looked at yet. A count rather
   * than a list of positions: only the puzzle knows whether those are cells, cages, words or clues,
   * and only its own editor has to render them.
   */
  unreviewedCount: (puzzle: TPuzzle) => number
  /**
   * Why solving would not mean anything yet, or `undefined` when it would. A sentence rather than a
   * flag, because it is shown to the user in place of the answer they asked for - and only the
   * puzzle knows what it is missing.
   *
   * Distinct from `unsolvable`, which is a fact about a complete puzzle and worth reporting. This is
   * about one that is not complete, where every result the solver could return would be true of
   * something the user did not describe.
   */
  solveBlocker: (puzzle: TPuzzle) => string | undefined
}

/**
 * What every puzzle's editor is handed. React-free, like the rest of this file - `ui-registry.ts`
 * is where these meet a component type.
 */
export type PuzzleEditorProps<TPuzzle> = {
  puzzle: TPuzzle
  onChange: (puzzle: TPuzzle) => void
  /**
   * Why solving right now would answer the wrong question, or `undefined` when it would not - the
   * counterpart to `solveBlocker` for the things only the editor knows.
   *
   * A half-finished edit is invisible in the puzzle itself: it is uncommitted, so `solveBlocker`
   * only ever sees the state before it and would let Solve answer a puzzle the user is midway
   * through replacing. An editor with no such state never calls this.
   */
  onBlockerChange: (blocker: string | undefined) => void
}

export type PuzzleSolutionProps<TPuzzle, TSolution> = {
  puzzle: TPuzzle
  solution: TSolution
}
