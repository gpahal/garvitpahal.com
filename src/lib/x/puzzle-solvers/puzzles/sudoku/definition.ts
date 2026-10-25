import { createWireRead } from '../../vision/extract-client'
import type { PuzzleDefinition } from '../types'
import { puzzleFromWire, SUDOKU_ID, sudokuPuzzleWireSchema } from './api'
import { createGrid, describeConflict, SUDOKU_SIZES } from './model'
import type { SudokuPuzzle } from './model'

export const sudoku: PuzzleDefinition<SudokuPuzzle, typeof SUDOKU_ID> = {
  id: SUDOKU_ID,
  name: 'Sudoku',
  blurb: `Take a picture of a Sudoku and get it solved. Sizes ${SUDOKU_SIZES.listed}`,
  read: createWireRead(SUDOKU_ID, sudokuPuzzleWireSchema, puzzleFromWire),
  blank: () => ({ grid: createGrid(9, 3, 3), uncertain: [] }),
  unreviewedCount: (puzzle) => puzzle.uncertain.length,
  reviewUnit: 'cell',
  reviewNote: (puzzle) =>
    puzzle.boxesGuessed
      ? 'The boxes were guessed. If they lie the other way in the picture, press Boxes to turn them, then solve'
      : undefined,
  // A repeat is named before solving, since its cells are already marked. Too few givens is the
  // solver's `multiple`, not a blocker.
  solveBlocker: (puzzle) => describeConflict(puzzle.grid),
  timeoutHint:
    'A Sudoku with few givens can have too many possibilities to check. Make sure no given is missing, then try again',
}
