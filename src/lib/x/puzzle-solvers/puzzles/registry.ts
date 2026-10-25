import { kenKen } from './ken-ken/definition'
import { sudoku } from './sudoku/definition'
import type { PuzzleDefinition } from './types'

/**
 * The page half of every puzzle; `compute-registry.ts` holds the Worker half. Adding a puzzle: see
 * docs/puzzle-solvers.md.
 */
const PUZZLES = {
  [sudoku.id]: sudoku,
  [kenKen.id]: kenKen,
}

export type PuzzleId = keyof typeof PUZZLES

export type PuzzleOf<TId extends PuzzleId> = ReturnType<(typeof PUZZLES)[TId]['blank']>
export type RegisteredPuzzle<TId extends PuzzleId> = PuzzleDefinition<PuzzleOf<TId>, TId>

export function listPuzzles(): Array<(typeof PUZZLES)[PuzzleId]> {
  return Object.values(PUZZLES)
}
