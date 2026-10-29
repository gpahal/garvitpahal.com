import { describe, expect, it } from 'vitest'

import { puzzleToWire, sudokuPuzzleWireSchema } from './api'
import type { SudokuPuzzleWire } from './api'
import { createGrid } from './model'

const wire = (n = 9, boxWidth = 3, boxHeight = 3, boxesGuessed?: true): SudokuPuzzleWire =>
  puzzleToWire({ grid: createGrid(n, boxWidth, boxHeight), uncertain: [], boxesGuessed })

// What this build sends passes, and what it could not have sent is refused (docs/puzzle-solvers.md,
// "Stale tabs").
describe('the Sudoku wire schema', () => {
  it.each([
    ['6 in 2x3 with guessed boxes', wire(6, 2, 3, true), true],
    [
      'a size with no grid',
      {
        n: 25,
        boxWidth: 5,
        boxHeight: 5,
        values: Array.from({ length: 625 }, () => 0),
        uncertain: [],
      },
      false,
    ],
    ['too few cells', { ...wire(), values: wire().values.slice(1) }, false],
    ['a value the grid cannot hold', { ...wire(), values: [10, ...wire().values.slice(1)] }, false],
    ['boxes that do not tile', { ...wire(), boxWidth: 4, boxHeight: 3 }, false],
    ['guessed square boxes', { ...wire(), boxesGuessed: true }, false],
    [
      'an uncertain cell listed twice',
      {
        ...wire(),
        uncertain: [
          { row: 0, col: 0 },
          { row: 0, col: 0 },
        ],
      },
      false,
    ],
    ['an uncertain cell outside the grid', { ...wire(), uncertain: [{ row: 9, col: 0 }] }, false],
  ])('judges %s', (_label, candidate, isAccepted) => {
    expect(sudokuPuzzleWireSchema.safeParse(candidate).success).toBe(isAccepted)
  })
})
