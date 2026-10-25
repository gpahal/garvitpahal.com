import { z } from 'zod'

import { cellName, indexOf } from '../../../grid/geometry'
import type { HintsShape } from '../../../vision/server/extract-handler'
import { formatMeasuredHints } from '../../../vision/server/prompt-text'
import type { SudokuHints } from '../api'
import { isValidBoxGeometry, SUDOKU_SIZES } from '../model'

const cellRefSchema = z.strictObject({
  row: z
    .int()
    .min(0)
    .max(SUDOKU_SIZES.max - 1),
  col: z
    .int()
    .min(0)
    .max(SUDOKU_SIZES.max - 1),
})

/**
 * A cell outside the grid would alias another in `indexOf`, and the prompt would name the wrong
 * cell as filled.
 */
function isWithinGrid({ n, boxWidth, boxHeight, empty }: SudokuHints): boolean {
  if (n === undefined) {
    return true
  }
  const areBoxesValid =
    boxWidth === undefined || boxHeight === undefined || isValidBoxGeometry(n, boxWidth, boxHeight)
  return areBoxesValid && (empty ?? []).every(({ row, col }) => row < n && col < n)
}

export const sudokuHintsSchema: z.ZodType<SudokuHints> = z
  .strictObject({
    n: z.literal([...SUDOKU_SIZES.list]).optional(),
    boxWidth: z.int().min(1).max(SUDOKU_SIZES.max).optional(),
    boxHeight: z.int().min(1).max(SUDOKU_SIZES.max).optional(),
    empty: z
      .array(cellRefSchema)
      .max(SUDOKU_SIZES.max * SUDOKU_SIZES.max)
      .optional(),
  } satisfies HintsShape<SudokuHints>)
  .refine(isWithinGrid, 'Hints must describe the grid they name')

export function describeHints(hints: SudokuHints): string {
  const lines: Array<string> = []
  if (hints.n !== undefined) {
    const boxes =
      hints.boxWidth !== undefined && hints.boxHeight !== undefined
        ? ` with boxes ${String(hints.boxWidth)} cells wide and ${String(hints.boxHeight)} cells tall`
        : ''
    lines.push(`The grid is ${String(hints.n)}x${String(hints.n)}${boxes}.`)
  }
  if (hints.n !== undefined && hints.empty !== undefined) {
    const { n } = hints
    const empty = new Set(hints.empty.map((cell) => indexOf(n, cell.row, cell.col)))
    const filled: Array<string> = []
    for (let cell = 0; cell < n * n; cell++) {
      if (!empty.has(cell)) {
        filled.push(cellName(n, cell))
      }
    }
    lines.push(
      filled.length === 0
        ? 'No cell appears to hold a printed digit.'
        : `Only these cells appear to hold a printed digit: ${filled.join(', ')}. Every other cell ` +
            'appears empty.',
    )
  }
  return formatMeasuredHints(lines)
}
