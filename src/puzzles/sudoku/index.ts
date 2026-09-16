import { pixelsToJpeg, RECTIFIED_JPEG_QUALITY } from '@/lib/capture/encode'
import { enhance } from '@/lib/capture/enhance'
import { toGray } from '@/lib/capture/pixels'
import { rectify, type Capture } from '@/lib/capture/rectify'
import { streamExtract } from '@/lib/vision/extract-client'
import { VERIFY_TIMEOUT_MS } from '@/puzzles/solve-result'
import type {
  ExtractOptions,
  ExtractOutcome,
  PuzzleDefinition,
  ReadAssessment,
} from '@/puzzles/types'

import { analyzeSudoku } from './analyze'
import {
  puzzleFromWire,
  SUDOKU_EXTRACT_PATH,
  SUDOKU_MAX_IMAGE_EDGE,
  SUDOKU_VISION_MODELS,
  type SudokuPuzzleWire,
} from './api'
import type { SudokuHints } from './hints'
import { createGrid, type SudokuPuzzle, type SudokuSolution } from './model'
import { solveSudoku } from './solve'

export type SudokuPrepared = {
  image: Blob
  hints: SudokuHints
}

/**
 * Crop, enhance, measure, encode. The enhanced crop is what lets the low-effort read skip
 * reasoning entirely on the bench (80 output tokens instead of 200-320, half the wall clock), and
 * the hints ride along in the request. No margin labels: they bought nothing on a sudoku and cost
 * 380 input tokens.
 */
async function prepare(capture: Capture): Promise<SudokuPrepared> {
  const enhanced = enhance(rectify(capture, SUDOKU_MAX_IMAGE_EDGE))
  const analysis = analyzeSudoku(toGray(enhanced))
  return { image: await pixelsToJpeg(enhanced, RECTIFIED_JPEG_QUALITY), hints: analysis.hints }
}

async function extract(
  prepared: SudokuPrepared,
  options: ExtractOptions<SudokuPuzzle>,
): Promise<ExtractOutcome> {
  return streamExtract<SudokuPuzzleWire, SudokuHints>(
    SUDOKU_EXTRACT_PATH,
    { image: prepared.image, models: SUDOKU_VISION_MODELS, hints: prepared.hints },
    {
      signal: options.signal,
      onRead: (wire, meta) => {
        options.onRead(puzzleFromWire(wire), meta)
      },
    },
  )
}

/**
 * A printed Sudoku has exactly one solution, so a unique solve is proof of a correct read and no
 * solution is proof of a wrong one. Everything in between - several solutions, or a search that
 * ran out of time - is neither, and two models agreeing on the same grid settles it instead.
 */
function assess(puzzle: SudokuPuzzle): ReadAssessment {
  const { grid } = puzzle
  const solved = solveSudoku(grid, { timeoutMs: VERIFY_TIMEOUT_MS })
  if (solved.status === 'unsolvable') {
    return { confidence: 'misread' }
  }
  const fingerprint = `${String(grid.n)},${String(grid.boxWidth)},${String(grid.boxHeight)},${[...grid.values].join('')}`
  return {
    confidence: solved.status === 'solved' && solved.isUnique ? 'trusted' : 'suspect',
    fingerprint,
  }
}

export const sudoku: PuzzleDefinition<SudokuPuzzle, SudokuSolution, SudokuPrepared> = {
  id: 'sudoku',
  name: 'Sudoku',
  blurb: 'Take a picture of a Sudoku and get it solved. Sizes from 4x4 to 16x16.',
  prepare,
  extract,
  assess,
  solve: (puzzle, options) => solveSudoku(puzzle.grid, options),
  blank: () => ({ grid: createGrid(9, 3, 3), uncertain: [] }),
  unreviewedCount: (puzzle) => puzzle.uncertain.length,
  // Never blocked: a grid is a complete Sudoku at every stage of being typed in, and the states
  // worth complaining about are ones the solver already answers for itself. Too few givens is
  // `multiple`, a repeated digit is `unsolvable`, and both come with copy explaining the misread.
  solveBlocker: () => undefined,
}
