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

export type ExtractResponse<TPuzzle> =
  { ok: true; puzzle: TPuzzle } | { ok: false; error: ExtractError }

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
 * `solve` is pure and isomorphic - it runs in the browser, so re-solving after a user edit costs
 * nothing. `extract` posts to that puzzle's own endpoint and returns its concrete response type.
 */
export type PuzzleDefinition<TPuzzle, TSolution> = {
  id: string
  name: string
  blurb: string
  /** Longest edge, in px, that captured images are downscaled to before upload. */
  maxImageEdge: number
  extract: (image: Blob) => Promise<ExtractResponse<TPuzzle>>
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
