import { cn } from 'cn'

import { colOf, rowOf } from '@/lib/x/puzzle-solvers/grid/geometry'
import { cageIdAt } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/model'
import type { KenKenGrid } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/model'

export function cellTextClass(n: number): string {
  return n > 6 ? 'text-[clamp(0.6rem,3vw,1rem)]' : 'text-[clamp(0.7rem,3.5vw,1.15rem)]'
}

export function clueTextClass(n: number): string {
  return n > 6 ? 'text-[clamp(0.6rem,2vw,0.78rem)]' : 'text-[clamp(0.7rem,2.6vw,0.95rem)]'
}

/**
 * Each cell draws only its top and left edges, so adjacent cells never double a line. Cage edges
 * use `muted-foreground`, not the values' `foreground`, so the frame does not compete with them.
 */
export function cageBorderClasses(grid: KenKenGrid, cell: number): string {
  const { n } = grid
  const row = rowOf(n, cell)
  const col = colOf(n, cell)
  const cageId = cageIdAt(grid, cell)
  return cn(
    'border-t border-l border-border',
    (col === 0 || cageIdAt(grid, cell - 1) !== cageId) &&
      'border-l-[3px] border-l-muted-foreground',
    (row === 0 || cageIdAt(grid, cell - n) !== cageId) &&
      'border-t-[3px] border-t-muted-foreground',
    col === n - 1 && 'border-r-[3px] border-r-muted-foreground',
    row === n - 1 && 'border-b-[3px] border-b-muted-foreground',
  )
}
