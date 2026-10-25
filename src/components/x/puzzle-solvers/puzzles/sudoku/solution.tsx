import type { ReactNode } from 'react'

import { cn } from 'cn'

import { colOf, rowOf } from '@/lib/x/puzzle-solvers/grid/geometry'
import { EMPTY, formatValue } from '@/lib/x/puzzle-solvers/puzzles/sudoku/model'
import type { SudokuPuzzle } from '@/lib/x/puzzle-solvers/puzzles/sudoku/model'

import { GridFrame } from '../../grid/grid-frame'
import { SolvedCell } from '../../grid/solved-cell'
import type { PuzzleSolutionProps } from '../puzzle-ui'
import { cellBorderClasses, cellTextClass } from './grid-view'

/**
 * Solved cells differ from given ones in weight as well as colour, so the distinction survives
 * greyscale and colour-blindness.
 */
export function SudokuSolutionView({
  puzzle,
  solution,
}: PuzzleSolutionProps<SudokuPuzzle>): ReactNode {
  const { grid } = puzzle
  const { n } = grid

  return (
    <GridFrame
      role="table"
      n={n}
      label="Solved Sudoku grid"
      renderCell={(cell) => {
        const value = formatValue(solution[cell] ?? EMPTY)
        const isGiven = (grid.values[cell] ?? EMPTY) !== EMPTY

        return (
          <SolvedCell
            key={cell}
            n={n}
            cell={cell}
            value={value}
            isGiven={isGiven}
            className={cn(
              cellTextClass(n),
              cellBorderClasses(grid, rowOf(n, cell), colOf(n, cell)),
              isGiven ? 'font-normal text-muted-foreground' : 'font-semibold text-foreground',
            )}
          >
            {value}
          </SolvedCell>
        )
      }}
    />
  )
}
