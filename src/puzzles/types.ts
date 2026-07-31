export type CellRef = {
  row: number
  col: number
}

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
  { ok: true; puzzle: TPuzzle; uncertain: Array<CellRef> } | { ok: false; error: ExtractError }

/**
 * `unsolvable` and `multiple` are the oracle that makes extraction from a picture trustworthy without any
 * computer-vision preprocessing: a well-formed puzzle has exactly one solution, so either result
 * means the grid was read wrong rather than that the puzzle is hard.
 */
export type SolveResult<TSolution> =
  | { status: 'solved'; solution: TSolution }
  | { status: 'unsolvable' }
  | { status: 'multiple'; solution: TSolution }
  | { status: 'timeout' }

export type SolveOptions = {
  timeoutMs: number
}

/**
 * Everything a puzzle type must provide. Kept free of React and of the Anthropic SDK so the same
 * module is safe to import from both the browser island and a server endpoint.
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
}
