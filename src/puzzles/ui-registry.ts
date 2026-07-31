import type { ComponentType } from 'react'

import type { CellRef } from '@/puzzles/types'

import type { PuzzleId } from './registry'
import { SudokuEditor } from './sudoku/editor'
import type { SudokuGrid, SudokuSolution } from './sudoku/model'
import { SudokuSolutionView } from './sudoku/solution'

export type PuzzleEditorProps<TPuzzle> = {
  grid: TPuzzle
  uncertain: Array<CellRef>
  onChange: (grid: TPuzzle) => void
}

export type PuzzleSolutionProps<TPuzzle, TSolution> = {
  grid: TPuzzle
  solution: TSolution
}

export type PuzzleUi<TPuzzle, TSolution> = {
  Editor: ComponentType<PuzzleEditorProps<TPuzzle>>
  Solution: ComponentType<PuzzleSolutionProps<TPuzzle, TSolution>>
}

/**
 * Imported only by the workspace island. Kept separate from `registry.ts` so server code can import
 * puzzle definitions without pulling React in.
 */
export const PUZZLE_UI: Record<PuzzleId, PuzzleUi<SudokuGrid, SudokuSolution>> = {
  sudoku: {
    Editor: SudokuEditor,
    Solution: SudokuSolutionView,
  },
}
