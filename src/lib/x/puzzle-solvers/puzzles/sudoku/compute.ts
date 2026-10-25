import { enhance } from '../../capture/enhance'
import { rectify } from '../../capture/rectify'
import type { PuzzleCompute } from '../types'
import { analyzeSudoku } from './analyze'
import { gridFingerprint } from './model'
import type { SudokuPuzzle } from './model'
import { solveSudoku } from './solve'

/**
 * 114px per cell on a 9x9, 64px on a 16x16.
 */
const CROP_EDGE = 1024

export const sudokuCompute: PuzzleCompute<SudokuPuzzle> = {
  prepare: (capture) => {
    const crop = enhance(rectify(capture, CROP_EDGE))
    return { pixels: crop, hints: analyzeSudoku(crop) }
  },
  // Guessed boxes could make a wrong puzzle solve uniquely, so such a read is never promoted.
  fingerprint: (puzzle) => (puzzle.boxesGuessed ? undefined : gridFingerprint(puzzle.grid)),
  solve: (puzzle, options) => solveSudoku(puzzle.grid, options),
}
