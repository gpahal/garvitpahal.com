import * as z from 'zod/mini'

import { EMPTY, isValidBoxGeometry, SUDOKU_SIZES } from './model'
import type { SudokuGrid, SudokuPuzzle, SudokuSize } from './model'

export const SUDOKU_ID = 'sudoku'

export type SudokuHints = {
  n?: SudokuSize
  boxWidth?: number
  boxHeight?: number
  empty?: Array<{ row: number; col: number }>
}

const cellRefSchema = z.object({ row: z.number(), col: z.number() })

/**
 * Closed to what this build constructs; see "Stale tabs" in docs/puzzle-solvers.md.
 * Uncertain cells are distinct and inside the grid because the editor highlights, clears and counts
 * them by cell.
 */
export const sudokuPuzzleWireSchema = z
  .object({
    n: z.number().check(z.refine(SUDOKU_SIZES.has, 'Unsupported grid size')),
    boxWidth: z.number(),
    boxHeight: z.number(),
    values: z.array(z.number()),
    uncertain: z.array(cellRefSchema),
    boxesGuessed: z.optional(z.literal(true)),
  })
  .check(
    z.refine(
      ({ n, boxWidth, boxHeight }) => isValidBoxGeometry(n, boxWidth, boxHeight),
      'Boxes must tile the grid exactly',
    ),
    z.refine(({ n, values }) => values.length === n * n, 'Expected one value per cell'),
    z.refine(
      ({ n, values }) =>
        values.every((value) => Number.isSafeInteger(value) && value >= EMPTY && value <= n),
      'A value must be empty or from 1 to n',
    ),
    z.refine(
      ({ n, uncertain }) =>
        uncertain.every(
          ({ row, col }) =>
            Number.isSafeInteger(row) &&
            Number.isSafeInteger(col) &&
            row >= 0 &&
            row < n &&
            col >= 0 &&
            col < n,
        ),
      'An uncertain cell is outside the grid',
    ),
    z.refine(
      ({ n, uncertain }) =>
        new Set(uncertain.map(({ row, col }) => row * n + col)).size === uncertain.length,
      'An uncertain cell is listed twice',
    ),
    // Only rectangular boxes can be guessed the wrong way round.
    z.refine(
      ({ boxWidth, boxHeight, boxesGuessed }) => !boxesGuessed || boxWidth !== boxHeight,
      'Square boxes cannot be guessed',
    ),
  )

export type SudokuPuzzleWire = z.infer<typeof sudokuPuzzleWireSchema>

export function puzzleToWire(puzzle: SudokuPuzzle): SudokuPuzzleWire {
  return {
    n: puzzle.grid.n,
    boxWidth: puzzle.grid.boxWidth,
    boxHeight: puzzle.grid.boxHeight,
    values: [...puzzle.grid.values],
    uncertain: puzzle.uncertain,
    ...(puzzle.boxesGuessed && { boxesGuessed: true }),
  }
}

export function puzzleFromWire(wire: SudokuPuzzleWire): SudokuPuzzle {
  const grid: SudokuGrid = {
    n: wire.n,
    boxWidth: wire.boxWidth,
    boxHeight: wire.boxHeight,
    values: Uint8Array.from(wire.values),
  }
  return { grid, uncertain: wire.uncertain, ...(wire.boxesGuessed && { boxesGuessed: true }) }
}
