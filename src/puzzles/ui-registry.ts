import type { ComponentType } from 'react'

import { KenKenEditor } from './ken-ken/editor'
import { KenKenSolutionView } from './ken-ken/solution'
import type { PuzzleId, PUZZLES } from './registry'
import { SudokuEditor } from './sudoku/editor'
import { SudokuSolutionView } from './sudoku/solution'
import type { PuzzleDefinition, PuzzleEditorProps, PuzzleSolutionProps } from './types'

export type PuzzleUi<TPuzzle, TSolution> = {
  Editor: ComponentType<PuzzleEditorProps<TPuzzle>>
  Solution: ComponentType<PuzzleSolutionProps<TPuzzle, TSolution>>
}

type PuzzleOf<TId extends PuzzleId> =
  (typeof PUZZLES)[TId] extends PuzzleDefinition<infer TPuzzle, infer _TSolution> ? TPuzzle : never

type SolutionOf<TId extends PuzzleId> =
  (typeof PUZZLES)[TId] extends PuzzleDefinition<infer _TPuzzle, infer TSolution>
    ? TSolution
    : never

/**
 * Imported only by the workspace island. Kept separate from `registry.ts` so server code can import
 * puzzle definitions without pulling React in.
 *
 * Typed per id rather than as one `Record`: `onChange` puts the puzzle type in both an argument and
 * a return position, so there is no single type that stands in for every puzzle. This still requires
 * an entry for every id, and checks each one against that puzzle's own types.
 */
export const PUZZLE_UI: { [TId in PuzzleId]: PuzzleUi<PuzzleOf<TId>, SolutionOf<TId>> } = {
  sudoku: {
    Editor: SudokuEditor,
    Solution: SudokuSolutionView,
  },
  'ken-ken': {
    Editor: KenKenEditor,
    Solution: KenKenSolutionView,
  },
}
