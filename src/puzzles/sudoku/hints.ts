import { z } from 'zod'

import { MAX_SUDOKU_SIZE, SUDOKU_SIZES } from './model'

/**
 * Facts the browser worked out from the picture before sending it, offered to the model as things
 * to verify rather than as ground truth. Every field is optional: a fact that was not unambiguous
 * is left out, because a wrong one misleads the whole read.
 *
 * Zod lives here rather than in `api.ts` so the browser can import the type without the schema:
 * the client only ever imports this module with `import type`.
 */
const cellRefSchema = z.strictObject({
  row: z
    .int()
    .min(0)
    .max(MAX_SUDOKU_SIZE - 1),
  col: z
    .int()
    .min(0)
    .max(MAX_SUDOKU_SIZE - 1),
})

export const sudokuHintsSchema = z.strictObject({
  n: z.literal([...SUDOKU_SIZES]).optional(),
  boxWidth: z.int().min(1).max(MAX_SUDOKU_SIZE).optional(),
  boxHeight: z.int().min(1).max(MAX_SUDOKU_SIZE).optional(),
  /**
  Cells with no ink in them.
  */
  empty: z
    .array(cellRefSchema)
    .max(MAX_SUDOKU_SIZE * MAX_SUDOKU_SIZE)
    .optional(),
})

export type SudokuHints = z.infer<typeof sudokuHintsSchema>
