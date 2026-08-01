/**
 * Geometry for puzzles that happen to be square grids. Opt-in: nothing in the puzzle lifecycle
 * depends on this, so a puzzle with no cells simply never imports it.
 *
 * Cells are numbered row-major, `0` at the top left.
 */

export type CellRef = {
  row: number
  col: number
}

const LETTER_A = 'A'.codePointAt(0)!

export function indexOf(n: number, row: number, col: number): number {
  return row * n + col
}

export function rowOf(n: number, cell: number): number {
  return Math.floor(cell / n)
}

export function colOf(n: number, cell: number): number {
  return cell % n
}

export function isInside(n: number, row: number, col: number): boolean {
  return row >= 0 && row < n && col >= 0 && col < n
}

/** The up-to-four cells sharing an edge with `cell`. */
export function orthogonalNeighbours(n: number, cell: number): Array<number> {
  const row = rowOf(n, cell)
  const col = colOf(n, cell)
  const neighbours: Array<number> = []

  for (const [rowStep, colStep] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    const nextRow = row + rowStep
    const nextCol = col + colStep
    if (isInside(n, nextRow, nextCol)) {
      neighbours.push(indexOf(n, nextRow, nextCol))
    }
  }

  return neighbours
}

export function rowGroups(n: number): Array<Uint16Array> {
  return Array.from({ length: n }, (_, row) =>
    Uint16Array.from({ length: n }, (_, col) => indexOf(n, row, col)),
  )
}

export function columnGroups(n: number): Array<Uint16Array> {
  return Array.from({ length: n }, (_, col) =>
    Uint16Array.from({ length: n }, (_, row) => indexOf(n, row, col)),
  )
}

/**
 * Spreadsheet notation: column letter then 1-based row, so cell 0 of any grid is `A1`.
 *
 * Used wherever a cell has to survive a round trip through a language model. A letter and a digit
 * cannot be transposed the way the two numbers of a `{ row, col }` pair can, and counting from 1
 * matches how a person reads a grid off a page.
 */
export function cellName(n: number, cell: number): string {
  return `${String.fromCodePoint(LETTER_A + colOf(n, cell))}${String(rowOf(n, cell) + 1)}`
}

export function parseCellName(n: number, name: string): number | undefined {
  const match = /^([A-Z])(\d+)$/.exec(name)
  if (!match) {
    return undefined
  }
  const col = match[1]!.codePointAt(0)! - LETTER_A
  const row = Number(match[2]) - 1
  return isInside(n, row, col) ? indexOf(n, row, col) : undefined
}

/** Every cell name of an `n` by `n` grid, row-major. */
export function cellNames(n: number): Array<string> {
  return Array.from({ length: n * n }, (_, cell) => cellName(n, cell))
}
