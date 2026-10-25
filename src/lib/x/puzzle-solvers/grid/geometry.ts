/**
 * Cells are numbered row-major, `0` at the top left.
 */

export type CellRef = {
  row: number
  col: number
}

const LETTER_A = 0x41

export function indexOf(n: number, row: number, col: number): number {
  return row * n + col
}

export function rowOf(n: number, cell: number): number {
  return Math.floor(cell / n)
}

export function colOf(n: number, cell: number): number {
  return cell % n
}

function isInside(n: number, row: number, col: number): boolean {
  return row >= 0 && row < n && col >= 0 && col < n
}

export type Keystroke = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }

/**
 * Any chord but Control with Home or End belongs to the browser or system, never a value or a move.
 */
export function chordOf({
  key,
  ctrlKey,
  metaKey,
  altKey,
}: Keystroke): 'gridEnd' | 'browser' | undefined {
  if (ctrlKey && !metaKey && !altKey && (key === 'Home' || key === 'End')) return 'gridEnd'
  return ctrlKey || metaKey || altKey ? 'browser' : undefined
}

/**
 * Stays put at an edge; `undefined` for a key that is not an arrow.
 */
export function cellAfterArrowKey(n: number, cell: number, key: string): number | undefined {
  const row = rowOf(n, cell)
  const col = colOf(n, cell)
  switch (key) {
    case 'ArrowUp': {
      return indexOf(n, Math.max(0, row - 1), col)
    }
    case 'ArrowDown': {
      return indexOf(n, Math.min(n - 1, row + 1), col)
    }
    case 'ArrowLeft': {
      return indexOf(n, row, Math.max(0, col - 1))
    }
    case 'ArrowRight': {
      return indexOf(n, row, Math.min(n - 1, col + 1))
    }
    default: {
      return undefined
    }
  }
}

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

/**
 * For a parser whose schema cannot tie a length to `n`.
 */
export function squareRowsError(n: number, rows: Array<Array<unknown>>): string | undefined {
  if (rows.length !== n) {
    return `Expected ${String(n)} rows, got ${String(rows.length)}`
  }
  const short = rows.findIndex((line) => line.length !== n)
  const row = rows[short]
  return row === undefined
    ? undefined
    : `Row ${String(short + 1)} has ${String(row.length)} cells, expected ${String(n)}`
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
 * Assumes whole boxes tile the grid; other shapes give groups that are not boxes.
 */
export function boxGroups(n: number, boxWidth: number, boxHeight: number): Array<Uint16Array> {
  const boxesPerRow = n / boxWidth
  return Array.from({ length: n }, (_, box) => {
    const top = Math.floor(box / boxesPerRow) * boxHeight
    const left = (box % boxesPerRow) * boxWidth
    return Uint16Array.from({ length: n }, (_, i) =>
      indexOf(n, top + Math.floor(i / boxWidth), left + (i % boxWidth)),
    )
  })
}

/**
 * Spreadsheet notation, for cells that round-trip through a language model: a letter and a digit
 * cannot be transposed the way a `{ row, col }` pair can.
 */
export function cellName(n: number, cell: number): string {
  return `${String.fromCodePoint(LETTER_A + colOf(n, cell))}${String(rowOf(n, cell) + 1)}`
}

export function parseCellName(n: number, name: string): number | undefined {
  const [, letter, digits] = /^([A-Z])(\d+)$/.exec(name) ?? []
  const code = letter?.codePointAt(0)
  if (code === undefined || digits === undefined) {
    return undefined
  }
  const col = code - LETTER_A
  const row = Number(digits) - 1
  return isInside(n, row, col) ? indexOf(n, row, col) : undefined
}

export function formatGridSize(n: number): string {
  return `${String(n)}×${String(n)}`
}

export function speakGridSize(n: number): string {
  return `${String(n)} by ${String(n)}`
}

/**
 * Grids store `n` as a plain number, so check `has` wherever a size arrives from outside. A size
 * off the list is a misread rather than an exotic puzzle.
 */
type GridSizes<T extends readonly [number, ...Array<number>]> = {
  list: T
  max: number
  has: (n: number) => boolean
  /**
   * Such as `4×4 to 16×16`.
   */
  range: string
  /**
   * Such as `4×4, 6×6 and 9×9`.
   */
  listed: string
}

export function gridSizes<const T extends readonly [number, ...Array<number>]>(
  list: T,
): GridSizes<T> {
  const sizes: ReadonlyArray<number> = list
  const max = Math.max(...list)
  return {
    list,
    max,
    has: (n) => sizes.includes(n),
    range: `${formatGridSize(list[0])} to ${formatGridSize(max)}`,
    listed: new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(list.map(formatGridSize)),
  }
}

/**
 * The start of a cell's accessible label.
 */
export function describeCell(n: number, cell: number): string {
  return `Row ${String(rowOf(n, cell) + 1)}, column ${String(colOf(n, cell) + 1)}`
}

export function cellNames(n: number): Array<string> {
  return Array.from({ length: n * n }, (_, cell) => cellName(n, cell))
}
