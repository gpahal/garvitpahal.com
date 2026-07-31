import type { VisionModels } from '@/lib/vision/model'
import type { CellRef, ExtractError } from '@/puzzles/types'

import { buildBoxRegions, type SudokuGrid } from './model'

export const SUDOKU_EXTRACT_PATH = '/api/x/puzzle-solvers/sudoku'

/** Upload ceiling, checked before the base64 is decoded. */
export const SUDOKU_MAX_IMAGE_BYTES = 6 * 1024 * 1024

export const SUDOKU_MAX_IMAGE_EDGE = 1600

/**
 * Sonnet 5 is the floor for the first read: Haiku 4.5 benchmarks faster on a clean synthetic grid
 * but misreads real pictures, and every miss costs a full retry.
 */
export const SUDOKU_VISION_MODELS: VisionModels = {
  primary: { id: 'claude-sonnet-5', effort: 'low' },
  fallbacks: [{ id: 'claude-opus-5', effort: 'low' }],
}

export type SudokuExtractRequest = {
  mediaType: string
  /** Base64, without a data-URL prefix. */
  data: string
  models: VisionModels
}

/** Typed arrays do not survive JSON, so the grid crosses the wire as plain arrays. */
export type SudokuGridWire = {
  n: number
  boxWidth: number
  boxHeight: number
  values: Array<number>
}

export type SudokuExtractResponse =
  | { ok: true; puzzle: SudokuGridWire; uncertain: Array<CellRef> }
  | { ok: false; error: ExtractError }

export function gridToWire(grid: SudokuGrid): SudokuGridWire {
  return {
    n: grid.n,
    boxWidth: grid.boxWidth,
    boxHeight: grid.boxHeight,
    values: [...grid.values],
  }
}

export function gridFromWire(wire: SudokuGridWire): SudokuGrid {
  return {
    n: wire.n,
    boxWidth: wire.boxWidth,
    boxHeight: wire.boxHeight,
    values: Uint8Array.from(wire.values),
    regions: buildBoxRegions(wire.n, wire.boxWidth, wire.boxHeight),
  }
}
