import {
  boxGroups,
  colOf,
  columnGroups,
  gridSizes,
  indexOf,
  rowGroups,
  rowOf,
} from '../../grid/geometry'
import type { CellRef } from '../../grid/geometry'

export const SUDOKU_SIZES = gridSizes([4, 6, 8, 9, 12, 16])

export type SudokuSize = (typeof SUDOKU_SIZES.list)[number]

export const EMPTY = 0

/**
 * A 6x6 is 2x3 or 3x2, which changes the puzzle. Grids carry only geometry that tiles
 * (`isValidBoxGeometry`). Jigsaw regions are not supported.
 */
export type SudokuGrid = {
  n: number
  boxWidth: number
  boxHeight: number
  /**
   * `EMPTY` or 1..n, row-major.
   */
  values: Uint8Array
}

export type SudokuPuzzle = {
  grid: SudokuGrid
  uncertain: Array<CellRef>
  /**
   * The read's boxes did not tile the grid, so defaults stood in, which may lie the wrong way. Value
   * edits keep it; turning the boxes or resizing drops it.
   */
  boxesGuessed?: true
}

export const SUDOKU_BOX_EDGES = [2, 3, 4] as const

/**
 * Edges come from `SUDOKU_BOX_EDGES`: a fractional edge (32 by 0.5 tiles a 16) would make
 * `boxGroups` emit groups that are not boxes, and a 1x9 box is a row.
 */
export function isValidBoxGeometry(n: number, boxWidth: number, boxHeight: number): boolean {
  const edges: ReadonlyArray<number> = SUDOKU_BOX_EDGES
  return edges.includes(boxWidth) && edges.includes(boxHeight) && boxWidth * boxHeight === n
}

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
  return { n, boxWidth, boxHeight, values: new Uint8Array(n * n) }
}

/**
 * Keeps the overlapping top-left block: a size change is usually a correction, such as a 6x6 read
 * as a 9x9, so the values that still fit are still wanted.
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
      const value = grid.values[indexOf(grid.n, row, col)] ?? EMPTY
      if (value <= n) {
        next.values[indexOf(n, row, col)] = value
      }
    }
  }
  return next
}

export function willResizeDropValues(grid: SudokuGrid, n: number): boolean {
  return grid.values.some(
    (value, cell) =>
      value !== EMPTY && (value > n || rowOf(grid.n, cell) >= n || colOf(grid.n, cell) >= n),
  )
}

export function cloneGrid(grid: SudokuGrid): SudokuGrid {
  return { ...grid, values: Uint8Array.from(grid.values) }
}

/**
 * Separated, because values reach two digits: run together, `1,0,12` and `10,1,2` would make two
 * misreads agree.
 */
export function gridFingerprint(grid: SudokuGrid): string {
  return [grid.n, grid.boxWidth, grid.boxHeight, ...grid.values].join(',')
}

export function formatValue(value: number): string {
  return value === EMPTY ? '' : String(value)
}

export function normalizeValue(value: number, n: number): number {
  return value >= 1 && value <= n ? value : EMPTY
}

type Clash = { group: 'Row' | 'Column' | 'Box'; index: number; value: number; cells: Array<number> }

function* clashes(grid: SudokuGrid): Generator<Clash> {
  const { n } = grid
  const groups = [
    ...rowGroups(n).map((cells, index) => ({ group: 'Row' as const, index, cells })),
    ...columnGroups(n).map((cells, index) => ({ group: 'Column' as const, index, cells })),
    ...boxGroups(n, grid.boxWidth, grid.boxHeight).map((cells, index) => ({
      group: 'Box' as const,
      index,
      cells,
    })),
  ]
  for (const { group, index, cells } of groups) {
    const byValue = new Map<number, Array<number>>()
    for (const cell of cells) {
      const value = grid.values[cell] ?? EMPTY
      if (value !== EMPTY) byValue.set(value, [...(byValue.get(value) ?? []), cell])
    }
    for (const [value, holders] of byValue) {
      if (holders.length > 1) yield { group, index, value, cells: holders }
    }
  }
}

export function findConflicts(grid: SudokuGrid): Array<number> {
  const conflicts = new Set<number>()
  for (const clash of clashes(grid)) {
    for (const cell of clash.cells) conflicts.add(cell)
  }
  return [...conflicts]
}

export function describeConflict(grid: SudokuGrid): string | undefined {
  const [first] = clashes(grid)
  return first
    ? `${first.group} ${String(first.index + 1)} has more than one ${formatValue(first.value)}. Fix the highlighted cells`
    : undefined
}
