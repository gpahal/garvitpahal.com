import type { ReactNode } from 'react'

import { PUZZLES, type PuzzleId } from '@/puzzles/registry'
import type { PuzzleDefinition } from '@/puzzles/types'
import { PUZZLE_UI, type PuzzleUi } from '@/puzzles/ui-registry'

import { Workspace } from './workspace'

type PuzzleWorkspaceProps = {
  puzzleId: PuzzleId
}

/**
 * The single hydrated island. Astro cannot hydrate a component resolved dynamically from a registry,
 * so this is statically imported and switches on `puzzleId` internally.
 *
 * The cast is the one place the registries are tied together: `PUZZLES[id]` and `PUZZLE_UI[id]` are
 * built for the same puzzle types by construction, but no index type can say so. Narrowed once here
 * rather than at every use, and `key` remounts if the id ever changes so no state crosses puzzles.
 */
export function PuzzleWorkspace({ puzzleId }: PuzzleWorkspaceProps): ReactNode {
  const definition = PUZZLES[puzzleId] as unknown as PuzzleDefinition<unknown, unknown>
  const ui = PUZZLE_UI[puzzleId] as unknown as PuzzleUi<unknown, unknown>

  return <Workspace key={puzzleId} definition={definition} ui={ui} />
}
