/** Sizes we accept. Anything else is a misread rather than an exotic puzzle. */
export const KEN_KEN_SIZES = [4, 5, 6, 7, 8] as const

export type KenKenSize = (typeof KEN_KEN_SIZES)[number]

export const MAX_KEN_KEN_SIZE = 8

/**
 * ASCII rather than the printed glyphs. These go straight into the extraction schema's enum, and
 * `×`, `÷` and `−` all have lookalike codepoints a model can drift to. `opSymbol` renders them.
 *
 * `=` is a single-cell cage: a bare number with no operator, which is a given.
 */
export const CAGE_OPS = ['+', '-', '*', '/', '='] as const

export type CageOp = (typeof CAGE_OPS)[number]

/** `target: 0` means unset - a cage still to be filled in, not one totalling zero. */
export type Cage = {
  op: CageOp
  target: number
}

/**
 * Cage membership is stored per cell, mirroring `SudokuGrid.regions`, so irregular shapes need no
 * special casing anywhere else.
 *
 * There is no `values` array: Ken Ken has no givens outside single-cell `=` cages, so the editor
 * never places a digit and the whole puzzle is its cage structure.
 */
export type KenKenGrid = {
  n: number
  /** Length `n * n`, row-major. An index into `cages`. */
  cageOf: Uint8Array
  cages: Array<Cage>
}

export type KenKenSolution = {
  /** Length `n * n`, row-major, every entry 1..n. */
  values: Uint8Array
}

/**
 * The reviewable unit is a cage, not a cell: what a model gets wrong here is a shape or a clue, and
 * highlighting the four cells of a mis-traced L says less than highlighting the cage itself.
 */
export type KenKenPuzzle = {
  grid: KenKenGrid
  /** Cage ids the model flagged, or the parser found inconsistent. Cleared as the user edits them. */
  unreviewedCages: Array<number>
}

export function isValidSize(n: number): n is KenKenSize {
  return (KEN_KEN_SIZES as ReadonlyArray<number>).includes(n)
}

export function cageIdAt(grid: KenKenGrid, cell: number): number {
  return grid.cageOf[cell] ?? 0
}

export function cageAt(grid: KenKenGrid, cell: number): Cage | undefined {
  return grid.cages[cageIdAt(grid, cell)]
}

export function cageCells(grid: KenKenGrid, cageId: number): Array<number> {
  const cells: Array<number> = []
  for (const [cell, id] of grid.cageOf.entries()) {
    if (id === cageId) {
      cells.push(cell)
    }
  }
  return cells
}

export function cageCellCount(grid: KenKenGrid, cageId: number): number {
  let count = 0
  for (const id of grid.cageOf) {
    if (id === cageId) {
      count++
    }
  }
  return count
}

/**
 * Whether this cell's value is printed on the puzzle rather than worked out - the one thing a
 * solved grid renders differently.
 *
 * The cell count is checked rather than inferred from the operator. `isCageArityValid` does hold a
 * `=` cage to one cell, but that is a rule the editor reports on, not one the type enforces, and a
 * misread grid can carry a `=` cage spanning three cells. Marking all three as printed would be a
 * quiet lie in both the styling and the label.
 */
export function isGivenCell(grid: KenKenGrid, cell: number): boolean {
  const cageId = cageIdAt(grid, cell)
  return grid.cages[cageId]?.op === '=' && cageCellCount(grid, cageId) === 1
}

/**
 * Topmost then leftmost cell of a cage - where the clue is printed, and the cell the extraction
 * format names the cage after. Cells are numbered row-major, so that is just the smallest index.
 *
 * `undefined` for a cage with no cells. Compaction makes that unreachable, but naming cell 0 instead
 * would put a clue in the top-left corner of the grid and read as a fact rather than a gap.
 */
export function cageAnchor(grid: KenKenGrid, cageId: number): number | undefined {
  for (const [cell, id] of grid.cageOf.entries()) {
    if (id === cageId) {
      return cell
    }
  }
  return undefined
}

/** Every cell its own unset single-cell cage: all walls up, ready to be knocked down. */
export function createGrid(n: number): KenKenGrid {
  const cageOf = new Uint8Array(n * n)
  const cages: Array<Cage> = []
  for (let cell = 0; cell < n * n; cell++) {
    cageOf[cell] = cell
    cages.push({ op: '=', target: 0 })
  }
  return { n, cageOf, cages }
}

export function cloneGrid(grid: KenKenGrid): KenKenGrid {
  return {
    n: grid.n,
    cageOf: Uint8Array.from(grid.cageOf),
    cages: grid.cages.map((cage) => ({ ...cage })),
  }
}

export function opSymbol(op: CageOp): string {
  switch (op) {
    case '+': {
      return '+'
    }
    case '-': {
      return '−'
    }
    case '*': {
      return '×'
    }
    case '/': {
      return '÷'
    }
    default: {
      return ''
    }
  }
}

/**
 * The clue as printed. Operator first, matching the apps these puzzles are usually photographed
 * from; most printed sources put it after the number instead, and the extraction prompt accepts
 * both. A single-cell cage prints its number alone.
 */
export function formatClue(cage: Cage): string {
  if (cage.target === 0) {
    return ''
  }
  return `${opSymbol(cage.op)}${String(cage.target)}`
}
