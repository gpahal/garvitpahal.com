import type { ComponentType, ReactNode } from 'react'

import type { Failure } from '@/lib/failure'
import { kenKen } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/definition'
import type { PuzzleId } from '@/lib/x/puzzle-solvers/puzzles/registry'
import { sudoku } from '@/lib/x/puzzle-solvers/puzzles/sudoku/definition'
import { ErrorBoundary } from '@/components/shared/error-boundary'

import { KenKenEditor } from './puzzles/ken-ken/editor'
import { KenKenSolutionView } from './puzzles/ken-ken/solution'
import { SudokuEditor } from './puzzles/sudoku/editor'
import { SudokuSolutionView } from './puzzles/sudoku/solution'
import { Workspace } from './workspace/workspace'

/**
 * Imported statically: the other puzzle's editor adds only a few kB to each page.
 */
const PUZZLE_WORKSPACES: Record<PuzzleId, ComponentType> = {
  sudoku: () => (
    <Workspace definition={sudoku} Editor={SudokuEditor} Solution={SudokuSolutionView} />
  ),
  'ken-ken': () => (
    <Workspace definition={kenKen} Editor={KenKenEditor} Solution={KenKenSolutionView} />
  ),
}

function crashFailure(): Failure {
  return {
    message: 'Something went wrong with this puzzle. Reload the page to try again',
    reload: true,
  }
}

type PuzzleWorkspaceProps = {
  puzzleId: PuzzleId
}

/**
 * One island, since Astro cannot hydrate a component resolved from a registry.
 */
export function PuzzleWorkspace({ puzzleId }: PuzzleWorkspaceProps): ReactNode {
  const Current = PUZZLE_WORKSPACES[puzzleId]
  return (
    <ErrorBoundary failureOf={crashFailure}>
      <Current />
    </ErrorBoundary>
  )
}
