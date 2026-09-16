import type { CellRef } from '@/lib/grid/geometry'
import type { VisionModels } from '@/lib/vision/model'

import { buildBoxRegions, type SudokuGrid, type SudokuPuzzle } from './model'

export const SUDOKU_EXTRACT_PATH = '/api/x/puzzle-solvers/sudoku'

/**
Upload ceiling, checked before the base64 is decoded.
*/
export const SUDOKU_MAX_IMAGE_BYTES = 6 * 1024 * 1024

/**
Long edge of the rectified crop: 114px per cell on a 9x9, 64px on a 16x16.
*/
export const SUDOKU_MAX_IMAGE_EDGE = 1024

/**
 * Every tier read every bench grid with reasoning off, so the hedges are the two fastest of those
 * plus one at low effort for the sizes the bench did not cover. Terra rides the fast lane: at this
 * price it is free, and the first read to land is the one on screen. Two hedges agreeing is as
 * good as a unique solve; Sol only runs if none of the three could be trusted.
 */
export const SUDOKU_VISION_MODELS: VisionModels = {
  hedges: [
    { id: 'gpt-5.6-luna', effort: 'none' },
    { id: 'gpt-5.6-terra', effort: 'none', tier: 'fast' },
    { id: 'gpt-5.6-terra', effort: 'low' },
  ],
  fallbacks: [{ id: 'gpt-5.6-sol', effort: 'medium', tier: 'fast' }],
}

/**
 * Typed arrays do not survive JSON, so the grid crosses the wire as plain arrays. `regions` is left
 * out: it is derivable from the box geometry, so sending it would be a second source of truth.
 *
 * Only ever produced by this app's own endpoint, so it is mapped rather than re-validated - the
 * untrusted direction is the image going out, which the endpoint's request schema checks.
 */
export type SudokuPuzzleWire = {
  n: number
  boxWidth: number
  boxHeight: number
  values: Array<number>
  uncertain: Array<CellRef>
}

export function puzzleToWire(puzzle: SudokuPuzzle): SudokuPuzzleWire {
  return {
    n: puzzle.grid.n,
    boxWidth: puzzle.grid.boxWidth,
    boxHeight: puzzle.grid.boxHeight,
    values: [...puzzle.grid.values],
    uncertain: puzzle.uncertain,
  }
}

export function puzzleFromWire(wire: SudokuPuzzleWire): SudokuPuzzle {
  const grid: SudokuGrid = {
    n: wire.n,
    boxWidth: wire.boxWidth,
    boxHeight: wire.boxHeight,
    values: Uint8Array.from(wire.values),
    regions: buildBoxRegions(wire.n, wire.boxWidth, wire.boxHeight),
  }
  return { grid, uncertain: wire.uncertain }
}
