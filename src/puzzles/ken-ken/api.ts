import type { VisionModels } from '@/lib/vision/model'

import type { Cage, KenKenPuzzle } from './model'

export const KEN_KEN_EXTRACT_PATH = '/api/x/puzzle-solvers/ken-ken'

/** Upload ceiling, checked before the base64 is decoded. */
export const KEN_KEN_MAX_IMAGE_BYTES = 6 * 1024 * 1024

export const KEN_KEN_MAX_IMAGE_EDGE = 1600

export const KEN_KEN_VISION_MODELS: VisionModels = {
  primary: { id: 'gpt-5.6-terra', effort: 'medium' },
  fallbacks: [{ id: 'gpt-5.6-sol', effort: 'xhigh' }],
}

/**
 * Typed arrays do not survive JSON. Unlike Sudoku's `regions`, `cageOf` is irreducible data rather
 * than something derivable from the geometry, so it crosses the wire in full.
 *
 * Only ever produced by this app's own endpoint, so it is mapped rather than re-validated - the
 * untrusted direction is the image going out, which `extractRequestSchema` checks.
 */
export type KenKenPuzzleWire = {
  n: number
  cageOf: Array<number>
  cages: Array<Cage>
  unreviewedCages: Array<number>
}

export function puzzleToWire(puzzle: KenKenPuzzle): KenKenPuzzleWire {
  return {
    n: puzzle.grid.n,
    cageOf: [...puzzle.grid.cageOf],
    cages: puzzle.grid.cages,
    unreviewedCages: puzzle.unreviewedCages,
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
  }
}
