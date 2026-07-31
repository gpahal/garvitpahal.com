import { sudoku } from './sudoku'

/**
 * Adding a puzzle: create `src/puzzles/<id>/`, add it here, add its UI to `ui-registry.ts`, and add
 * an endpoint at `src/pages/api/x/puzzle-solvers/<id>.ts`.
 *
 * Client-safe by construction: no Anthropic SDK, no React, and no prompt text - those live in each
 * puzzle's `extraction.ts`, which only its endpoint imports.
 */
export const PUZZLES = {
  sudoku,
} as const

export type PuzzleId = keyof typeof PUZZLES

export function listPuzzles(): Array<(typeof PUZZLES)[PuzzleId]> {
  return Object.values(PUZZLES)
}

export function isPuzzleId(id: string): id is PuzzleId {
  return Object.hasOwn(PUZZLES, id)
}
