import type { CellRef } from '@/lib/grid/geometry'
import type { VisionModels } from '@/lib/vision/model'

import { buildBoxRegions, type SudokuGrid, type SudokuPuzzle } from './model'

export const SUDOKU_EXTRACT_PATH = '/api/x/puzzle-solvers/sudoku'

/** Upload ceiling, checked before the base64 is decoded. */
export const SUDOKU_MAX_IMAGE_BYTES = 6 * 1024 * 1024

export const SUDOKU_MAX_IMAGE_EDGE = 1600

export const SUDOKU_VISION_MODELS: VisionModels = {
  primary: { id: 'gpt-5.6-terra', effort: 'low' },
  fallbacks: [
    { id: 'gpt-5.6-sol', effort: 'medium' },
    { id: 'gpt-5.6-sol', effort: 'high' },
  ],
}

/**
 * Typed arrays do not survive JSON, so the grid crosses the wire as plain arrays. `regions` is left
 * out: it is derivable from the box geometry, so sending it would be a second source of truth.
 *
 * Only ever produced by this app's own endpoint, so it is mapped rather than re-validated - the
 * untrusted direction is the image going out, which `extractRequestSchema` checks.
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
