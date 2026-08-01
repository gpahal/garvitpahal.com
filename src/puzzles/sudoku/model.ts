import { indexOf, type CellRef } from '@/lib/grid/geometry'

/** Sizes we accept. Anything else is a misread rather than an exotic puzzle. */
export const SUDOKU_SIZES = [4, 6, 8, 9, 12, 16] as const

export type SudokuSize = (typeof SUDOKU_SIZES)[number]

export const MAX_SUDOKU_SIZE = 16

/** Empty cell marker in both the wire format and the model. */
export const EMPTY = 0

/**
 * Region membership is stored per cell rather than derived from box arithmetic. Rectangular boxes
 * (a 6x6 is 2x3 or 3x2 - a correctness difference, not a cosmetic one) and irregular/jigsaw
 * variants then need no special casing anywhere else.
 */
export type SudokuGrid = {
  n: number
  boxWidth: number
  boxHeight: number
  /** Length `n * n`, row-major. `EMPTY` or 1..n. */
  values: Uint8Array
  /** Length `n * n`, row-major. Region id in 0..n-1. */
  regions: Uint8Array
}

export type SudokuSolution = {
  /** Length `n * n`, row-major, every entry 1..n. */
  values: Uint8Array
}

/**
 * What the workspace holds and the editor edits. `uncertain` rides with the grid rather than beside
 * it so a resize cannot leave stale refs pointing at unrelated cells.
 */
export type SudokuPuzzle = {
  grid: SudokuGrid
  uncertain: Array<CellRef>
}

export function valueAt(grid: SudokuGrid, row: number, col: number): number {
  return grid.values[indexOf(grid.n, row, col)] ?? EMPTY
}

export function regionAt(grid: SudokuGrid, row: number, col: number): number {
  return grid.regions[indexOf(grid.n, row, col)] ?? 0
}

export function isValidSize(n: number): n is SudokuSize {
  return (SUDOKU_SIZES as ReadonlyArray<number>).includes(n)
}

/** Box geometry is only coherent when the boxes tile the grid exactly. */
export function isValidBoxGeometry(n: number, boxWidth: number, boxHeight: number): boolean {
  return (
    boxWidth > 0 &&
    boxHeight > 0 &&
    boxWidth * boxHeight === n &&
    n % boxWidth === 0 &&
    n % boxHeight === 0
  )
}

/** Region map for regular (rectangular-box) sudoku. */
export function buildBoxRegions(n: number, boxWidth: number, boxHeight: number): Uint8Array {
  const regions = new Uint8Array(n * n)
  const boxesPerRow = n / boxWidth
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      regions[indexOf(n, row, col)] =
        Math.floor(row / boxHeight) * boxesPerRow + Math.floor(col / boxWidth)
    }
  }
  return regions
}

/** Default box geometry for a size, used when the model does not report one. */
export function defaultBoxGeometry(n: number): { boxWidth: number; boxHeight: number } {
  switch (n) {
    case 4: {
      return { boxWidth: 2, boxHeight: 2 }
    }
    case 6: {
      return { boxWidth: 3, boxHeight: 2 }
    }
    case 8: {
      return { boxWidth: 4, boxHeight: 2 }
    }
    case 12: {
      return { boxWidth: 4, boxHeight: 3 }
    }
    case 16: {
      return { boxWidth: 4, boxHeight: 4 }
    }
    default: {
      return { boxWidth: 3, boxHeight: 3 }
    }
  }
}

export function createGrid(n: number, boxWidth: number, boxHeight: number): SudokuGrid {
  return {
    n,
    boxWidth,
    boxHeight,
    values: new Uint8Array(n * n),
    regions: buildBoxRegions(n, boxWidth, boxHeight),
  }
}

/**
 * Re-shapes a grid, carrying over the overlapping top-left block. A size change is a correction -
 * the model read a 6x6 as a 9x9, or manual entry started at the 9x9 default - so the values that
 * still fit are usually still wanted. Values above the new `n` cannot exist there and are dropped.
 */
export function resizeGrid(
  grid: SudokuGrid,
  n: number,
  boxWidth: number,
  boxHeight: number,
): SudokuGrid {
  const next = createGrid(n, boxWidth, boxHeight)
  const span = Math.min(grid.n, n)
  for (let row = 0; row < span; row++) {
    for (let col = 0; col < span; col++) {
      const value = valueAt(grid, row, col)
      if (value <= n) {
        next.values[indexOf(n, row, col)] = value
      }
    }
  }
  return next
}

export function cloneGrid(grid: SudokuGrid): SudokuGrid {
  return {
    ...grid,
    values: Uint8Array.from(grid.values),
    regions: Uint8Array.from(grid.regions),
  }
}

/** Values render as their number; `EMPTY` renders as nothing. */
export function formatValue(value: number): string {
  return value === EMPTY ? '' : String(value)
}

/**
 * Single-keystroke entry for the grid editor. Digits 1-9 map directly; 0, Backspace and Delete
 * clear. Values 10-16 have no single key, so those come from the on-screen value pad instead.
 */
export function parseKeyboardValue(key: string, n: number): number {
  if (!/^\d$/.test(key)) {
    return EMPTY
  }
  const value = Number(key)
  return value >= 1 && value <= n ? value : EMPTY
}

/** Clamps a value from an untrusted source to `EMPTY` or 1..n. */
export function normalizeValue(value: unknown, n: number): number {
  return Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= n
    ? (value as number)
    : EMPTY
}

/** Cells that conflict with another given in the same row, column, or region. */
export function findConflicts(grid: SudokuGrid): Array<number> {
  const conflicts = new Set<number>()
  const { n } = grid

  const check = (cells: Array<number>): void => {
    const seen = new Map<number, number>()
    for (const cell of cells) {
      const value = grid.values[cell] ?? EMPTY
      if (value === EMPTY) {
        continue
      }
      const previous = seen.get(value)
      if (previous === undefined) {
        seen.set(value, cell)
      } else {
        conflicts.add(previous)
        conflicts.add(cell)
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const row: Array<number> = []
    const col: Array<number> = []
    for (let j = 0; j < n; j++) {
      row.push(indexOf(n, i, j))
      col.push(indexOf(n, j, i))
    }
    check(row)
    check(col)
  }

  const byRegion = new Map<number, Array<number>>()
  for (let cell = 0; cell < n * n; cell++) {
    const region = grid.regions[cell] ?? 0
    const bucket = byRegion.get(region)
    if (bucket) {
      bucket.push(cell)
    } else {
      byRegion.set(region, [cell])
    }
  }
  for (const cells of byRegion.values()) {
    check(cells)
  }

  return [...conflicts]
}
