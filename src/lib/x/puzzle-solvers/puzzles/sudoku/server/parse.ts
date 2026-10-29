import { z } from 'zod'

import {
  cellNames,
  colOf,
  indexOf,
  parseCellName,
  rowOf,
  squareRowsError,
} from '../../../grid/geometry'
import type { ParseResult } from '../../types'
import {
  defaultBoxGeometry,
  EMPTY,
  isValidBoxGeometry,
  normalizeValue,
  SUDOKU_BOX_EDGES,
  SUDOKU_SIZES,
} from '../model'
import type { SudokuPuzzle } from '../model'

/**
 * An enum because the structured-output subset has no `minimum`/`maximum`. Rows are integer arrays,
 * not strings, because the cheapest model cannot keep a string row to `n` characters or to one blank
 * symbol.
 */
const CELL_VALUES = Array.from({ length: SUDOKU_SIZES.max + 1 }, (_, value) => value)

const cellNameSchema = z.enum(cellNames(SUDOKU_SIZES.max))

const cellValueSchema = z
  .literal(CELL_VALUES)
  .describe('The printed value, or 0 for an empty cell.')

const cellRowSchema = z.array(cellValueSchema)

/**
 * The descriptions are prompt text. The structured-output subset cannot tie a length or value to
 * `n`, so `parseSudoku` checks those.
 */
export const sudokuRawSchema = z.strictObject({
  n: z.literal([...SUDOKU_SIZES.list]).describe('Grid width and height in cells.'),
  boxWidth: z
    .literal([...SUDOKU_BOX_EDGES])
    .describe('Width of one box (the sub-region bounded by thick lines), in cells.'),
  boxHeight: z.literal([...SUDOKU_BOX_EDGES]).describe('Height of one box, in cells.'),
  cells: z
    .array(cellRowSchema)
    .describe('Rows, top to bottom. Each row is left to right. Exactly n rows of n entries.'),
  uncertain: z
    .array(cellNameSchema)
    .describe('Names of cells you are not fully confident about. Empty array if none.'),
})

export type SudokuRaw = z.infer<typeof sudokuRawSchema>

export type ParsedSudoku = SudokuPuzzle & {
  /**
   * The model's boxes when they did not tile and the default replaced them. Only logged.
   */
  unusableBoxes?: { boxWidth: number; boxHeight: number }
}

export function parseSudoku(raw: SudokuRaw): ParseResult<ParsedSudoku> {
  const { n } = raw

  const isTiling = isValidBoxGeometry(n, raw.boxWidth, raw.boxHeight)
  const { boxWidth, boxHeight } = isTiling ? raw : defaultBoxGeometry(n)
  const isGuessed = !isTiling && boxWidth !== boxHeight

  const shapeError = squareRowsError(n, raw.cells)
  if (shapeError !== undefined) {
    return { ok: false, message: shapeError }
  }

  const values = new Uint8Array(n * n)
  // An out-of-range value is emptied and flagged, so review points at the cell.
  const emptied: Array<number> = []
  for (const [row, line] of raw.cells.entries()) {
    for (const [col, cell] of line.entries()) {
      const index = indexOf(n, row, col)
      const value = normalizeValue(cell, n)
      values[index] = value
      if (value === EMPTY && cell !== EMPTY) emptied.push(index)
    }
  }

  // Nothing stops a model naming one cell twice, and the review banner counts these.
  const named = new Set<number>()
  for (const name of raw.uncertain) {
    const index = parseCellName(n, name)
    if (index !== undefined) named.add(index)
  }
  for (const index of emptied) named.add(index)

  return {
    ok: true,
    puzzle: {
      grid: { n, boxWidth, boxHeight, values },
      uncertain: Array.from(named, (index) => ({ row: rowOf(n, index), col: colOf(n, index) })),
      ...(isGuessed && { boxesGuessed: true }),
      ...(!isTiling && { unusableBoxes: { boxWidth: raw.boxWidth, boxHeight: raw.boxHeight } }),
    },
  }
}
