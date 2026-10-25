import type { ReactNode } from 'react'

import { cn } from 'cn'

import { cageIdAt, formatClue } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/model'
import type { KenKenGrid } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/model'

import { clueTextClass } from './grid-classes'

export function CageClue({
  grid,
  cell,
  isAnchor,
  className,
  hasPlaceholder = false,
}: {
  grid: KenKenGrid
  cell: number
  /**
   * Passed in, since finding it scans the grid and this renders per cell.
   */
  isAnchor: boolean
  className?: string
  /**
   * Marks a cage with no clue yet, which would otherwise look like any other cell. Muted rather than
   * an error, since every hand-entered cage starts this way.
   */
  hasPlaceholder?: boolean
}): ReactNode {
  const cage = isAnchor ? grid.cages[cageIdAt(grid, cell)] : undefined
  if (!cage) {
    return undefined
  }

  const isUnset = cage.target === 0
  return isUnset && !hasPlaceholder ? undefined : (
    <span
      aria-hidden="true"
      className={cn(
        'absolute top-0.5 left-1 leading-none font-semibold',
        clueTextClass(grid.n),
        isUnset ? 'text-ring' : (className ?? 'text-muted-foreground'),
      )}
    >
      {isUnset ? '?' : formatClue(cage)}
    </span>
  )
}
