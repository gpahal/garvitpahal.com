import type { ReactNode } from 'react'

import { indexOf } from '@/lib/grid/geometry'

import { cellBorderClasses, cellTextClass } from './editor'
import { EMPTY, formatValue, type SudokuPuzzle, type SudokuSolution } from './model'

type SudokuSolutionViewProps = {
  puzzle: SudokuPuzzle
  solution: SudokuSolution
}

/**
 * The solved cells carry the weight: they are what the user came for, and the givens are already
 * on the page in front of them. Distinguished by weight rather than colour, so the distinction
 * survives greyscale, colour-blindness, and the gray-only palette.
 */
export function SudokuSolutionView({ puzzle, solution }: SudokuSolutionViewProps): ReactNode {
  const { grid } = puzzle
  const { n } = grid

  return (
    // Cells are grouped per row because `gridcell` is only meaningful inside a `row`. The wrappers
    // are `display: contents`, so the CSS grid lays every cell out as before.
    <div
      role="grid"
      aria-label="Solved Sudoku grid"
      aria-rowcount={n}
      aria-colcount={n}
      className="mx-auto grid w-full max-w-md"
      style={{ gridTemplateColumns: `repeat(${String(n)}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: n }, (_, row) => (
        <div key={row} role="row" className="contents">
          {Array.from({ length: n }, (_, col) => {
            const cell = indexOf(n, row, col)
            const value = solution.values[cell] ?? EMPTY
            const isGiven = (grid.values[cell] ?? EMPTY) !== EMPTY

            return (
              <div
                key={cell}
                role="gridcell"
                aria-rowindex={row + 1}
                aria-colindex={col + 1}
                aria-label={`Row ${String(row + 1)}, column ${String(col + 1)}, ${formatValue(
                  value,
                )}${isGiven ? ', given' : ', solved'}`}
                className={[
                  'flex aspect-square items-center justify-center bg-bg',
                  cellTextClass(n),
                  cellBorderClasses(grid, row, col),
                  isGiven ? 'font-normal text-gray-11' : 'font-semibold text-gray-12',
                ].join(' ')}
              >
                {formatValue(value)}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
