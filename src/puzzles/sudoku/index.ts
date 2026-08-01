import { postExtract } from '@/lib/vision/extract-client'
import type { ExtractResponse, PuzzleDefinition } from '@/puzzles/types'

import {
  puzzleFromWire,
  SUDOKU_EXTRACT_PATH,
  SUDOKU_MAX_IMAGE_EDGE,
  SUDOKU_VISION_MODELS,
  type SudokuPuzzleWire,
} from './api'
import { createGrid, type SudokuPuzzle, type SudokuSolution } from './model'
import { solveSudoku } from './solve'

async function extract(image: Blob): Promise<ExtractResponse<SudokuPuzzle>> {
  const response = await postExtract<SudokuPuzzleWire>(
    SUDOKU_EXTRACT_PATH,
    image,
    SUDOKU_VISION_MODELS,
  )
  return response.ok ? { ok: true, puzzle: puzzleFromWire(response.puzzle) } : response
}

export const sudoku: PuzzleDefinition<SudokuPuzzle, SudokuSolution> = {
  id: 'sudoku',
  name: 'Sudoku',
  blurb: 'Take a picture of a Sudoku and get it solved. Sizes from 4x4 to 16x16.',
  maxImageEdge: SUDOKU_MAX_IMAGE_EDGE,
  extract,
  solve: (puzzle, options) => solveSudoku(puzzle.grid, options),
  blank: () => ({ grid: createGrid(9, 3, 3), uncertain: [] }),
  unreviewedCount: (puzzle) => puzzle.uncertain.length,
  // Never blocked: a grid is a complete Sudoku at every stage of being typed in, and the states
  // worth complaining about are ones the solver already answers for itself. Too few givens is
  // `multiple`, a repeated digit is `unsolvable`, and both come with copy explaining the misread.
  solveBlocker: () => undefined,
}
