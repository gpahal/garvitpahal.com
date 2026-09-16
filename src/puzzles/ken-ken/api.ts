import type { VisionModels } from '@/lib/vision/model'

import type { Cage, KenKenPuzzle } from './model'

export const KEN_KEN_EXTRACT_PATH = '/api/x/puzzle-solvers/ken-ken'

/**
Upload ceiling, checked before the base64 is decoded.
*/
export const KEN_KEN_MAX_IMAGE_BYTES = 6 * 1024 * 1024

/**
Long edge of the rectified crop the lattice is measured on. Never upscaled past its native size.
*/
export const KEN_KEN_MAX_IMAGE_EDGE = 1024

/**
Long edge of the picture actually sent, which is the whole frame.
*/
export const KEN_KEN_MAX_PICTURE_EDGE = 1600

/**
 * Three reads at once, no reasoning to medium, so the first grid is on screen in a few seconds
 * and the medium read - the cheapest tier that read every bench image - usually confirms it. Sol
 * at its highest effort only runs if none of the three could be trusted.
 */
export const KEN_KEN_VISION_MODELS: VisionModels = {
  hedges: [
    { id: 'gpt-5.6-terra', effort: 'none' },
    { id: 'gpt-5.6-terra', effort: 'low' },
    { id: 'gpt-5.6-terra', effort: 'medium', tier: 'fast' },
  ],
  fallbacks: [{ id: 'gpt-5.6-sol', effort: 'xhigh', tier: 'fast' }],
}

/**
 * Typed arrays do not survive JSON. Unlike Sudoku's `regions`, `cageOf` is irreducible data rather
 * than something derivable from the geometry, so it crosses the wire in full.
 *
 * Only ever produced by this app's own endpoint, so it is mapped rather than re-validated - the
 * untrusted direction is the image going out, which the endpoint's request schema checks.
 */
export type KenKenPuzzleWire = {
  n: number
  cageOf: Array<number>
  cages: Array<Cage>
  unreviewedCages: Array<number>
  contradictions: Array<number>
}

export function puzzleToWire(puzzle: KenKenPuzzle): KenKenPuzzleWire {
  return {
    n: puzzle.grid.n,
    cageOf: [...puzzle.grid.cageOf],
    cages: puzzle.grid.cages,
    unreviewedCages: puzzle.unreviewedCages,
    contradictions: puzzle.contradictions,
  }
}

export function puzzleFromWire(wire: KenKenPuzzleWire): KenKenPuzzle {
  return {
    grid: {
      n: wire.n,
      cageOf: Uint8Array.from(wire.cageOf),
      cages: wire.cages,
    },
    unreviewedCages: wire.unreviewedCages,
    contradictions: wire.contradictions,
  }
}
