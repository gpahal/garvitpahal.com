import { kenKenCompute } from './ken-ken/compute'
import type { PuzzleId, PuzzleOf } from './registry'
import { sudokuCompute } from './sudoku/compute'
import type { PuzzleCompute } from './types'

/**
 * Only `processing/worker.ts` imports it, so image and solver code stays out of the page chunk.
 */
const COMPUTES: { [TId in PuzzleId]: PuzzleCompute<PuzzleOf<TId>> } = {
  sudoku: sudokuCompute,
  'ken-ken': kenKenCompute,
}

export function puzzleCompute<TId extends PuzzleId>(id: TId): PuzzleCompute<PuzzleOf<TId>> {
  return COMPUTES[id]
}
