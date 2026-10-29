import { kenKen } from './ken-ken/definition'
import { sudoku } from './sudoku/definition'
import type { PuzzleDefinition } from './types'

/**
 * Adding a puzzle: docs/puzzle-solvers.md.
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
