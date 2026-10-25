import { cn } from 'cn'

import type { SudokuGrid } from '@/lib/x/puzzle-solvers/puzzles/sudoku/model'

/**
 * Two-digit values need smaller type; `GridFrame`'s minimum cell keeps them legible.
 */
export function cellTextClass(n: number): string {
  return n > 9 ? 'text-[clamp(0.7rem,2.2vw,0.8rem)]' : 'text-[clamp(0.7rem,3.5vw,1.15rem)]'
}

export function cellBorderClasses(grid: SudokuGrid, row: number, col: number): string {
  const { n, boxWidth, boxHeight } = grid
  return cn(
    'border-t border-l border-border',
    col % boxWidth === 0 && 'border-l-2 border-l-ring',
    row % boxHeight === 0 && 'border-t-2 border-t-ring',
    col === n - 1 && 'border-r-2 border-r-ring',
    row === n - 1 && 'border-b-2 border-b-ring',
  )
}
