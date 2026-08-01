import { z } from 'zod'

import { indexOf, type CellRef } from '@/lib/grid/geometry'

import {
  buildBoxRegions,
  defaultBoxGeometry,
  isValidBoxGeometry,
  isValidSize,
  normalizeValue,
  type SudokuGrid,
} from './model'

/**
 * Shape the model is constrained to by the extraction schema, checked rather than assumed. Only the
 * shape: everything value-dependent - row counts against `n`, cells in range for this grid - is
 * `parseSudoku`'s job, because those are recoverable and want a message rather than a rejection.
 */
const cellRefSchema = z.object({ row: z.int(), col: z.int() })

/** 0 for an empty cell, otherwise the printed value 1..n. */
const cellRowSchema = z.array(z.int())

export const sudokuRawSchema = z.object({
  n: z.int(),
  boxWidth: z.int(),
  boxHeight: z.int(),
  cells: z.array(cellRowSchema),
  uncertain: z.array(cellRefSchema),
})

export type SudokuRaw = z.infer<typeof sudokuRawSchema>

export type ParseResult =
  { ok: true; grid: SudokuGrid; uncertain: Array<CellRef> } | { ok: false; message: string }

/**
 * Validates model output into a grid. The schema constrains types but cannot constrain array
 * lengths, so row and column counts are checked here.
 */
export function parseSudoku(raw: SudokuRaw): ParseResult {
  const { n } = raw

  if (!isValidSize(n)) {
    return { ok: false, message: `Unsupported grid size: ${String(n)}` }
  }

  let { boxWidth, boxHeight } = raw
  if (!isValidBoxGeometry(n, boxWidth, boxHeight)) {
    // A wrong size is fatal, but wrong box geometry is recoverable: fall back to the conventional
    // layout for this size and let the user correct it if the puzzle is unusual.
    const fallback = defaultBoxGeometry(n)
    boxWidth = fallback.boxWidth
    boxHeight = fallback.boxHeight
  }

  if (!Array.isArray(raw.cells) || raw.cells.length !== n) {
    return {
      ok: false,
      message: `Expected ${String(n)} rows, got ${String(raw.cells?.length ?? 0)}`,
    }
  }

  const values = new Uint8Array(n * n)
  for (const [row, line] of raw.cells.entries()) {
    if (!Array.isArray(line) || line.length !== n) {
      return {
        ok: false,
        message: `Row ${String(row + 1)} has ${String(line?.length ?? 0)} cells, expected ${String(n)}`,
      }
    }
    for (const [col, cell] of line.entries()) {
      // The schema constrains cells to 0..16, but n may be smaller; anything out of range for this
      // grid is treated as empty so the review step surfaces it as a gap rather than a bad given.
      values[indexOf(n, row, col)] = normalizeValue(cell, n)
    }
  }

  const uncertain: Array<CellRef> = []
  const reportedUncertain = raw.uncertain ?? []
  for (const cell of reportedUncertain) {
    if (
      Number.isSafeInteger(cell?.row) &&
      Number.isSafeInteger(cell?.col) &&
      cell.row >= 0 &&
      cell.row < n &&
      cell.col >= 0 &&
      cell.col < n
    ) {
      uncertain.push({ row: cell.row, col: cell.col })
    }
  }

  return {
    ok: true,
    grid: {
      n,
      boxWidth,
      boxHeight,
      values,
      regions: buildBoxRegions(n, boxWidth, boxHeight),
    },
    uncertain,
  }
}
