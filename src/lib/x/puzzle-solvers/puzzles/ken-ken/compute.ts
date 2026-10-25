import { rectify } from '../../capture/rectify'
import type { PuzzleCompute } from '../types'
import { analyzeKenKen } from './analyze'
import { gridFingerprint } from './model'
import type { KenKenPuzzle } from './model'
import { solveKenKen } from './solve'

const MEASURE_EDGE = 1024

/**
 * Sized per cell, since clues are small print in a corner: about 148px a cell on an 8x8, putting a
 * clue near 35px tall. The crop is never upscaled past what the camera saw.
 */
export const SEND_EDGE = 1280

/**
 * A share of the grid on each side, about a third of a cell on an 8x8: a corner placed a little
 * inside the border would otherwise clip the clues printed against it. Hints name cells, not
 * pixels, so they stay valid.
 */
export const SEND_MARGIN = 0.04

export const kenKenCompute: PuzzleCompute<KenKenPuzzle> = {
  // Not enhanced: enhancement reshapes the fine strokes the model must read, and its sharpening
  // rings beside heavy borders, where Ken Ken prints its clues.
  prepare: (capture) => ({
    pixels: rectify(capture, SEND_EDGE, SEND_MARGIN),
    hints: analyzeKenKen(rectify(capture, MEASURE_EDGE)),
  }),
  // A read that contradicts itself was misread systematically, so two models agreeing on it must
  // not promote it. The model's own `uncertain` list only drives review.
  fingerprint: (puzzle) =>
    puzzle.contradictions.length > 0 ? undefined : gridFingerprint(puzzle.grid),
  solve: solveKenKen,
}
