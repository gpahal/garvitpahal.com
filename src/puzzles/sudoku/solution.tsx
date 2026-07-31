import type { ReactNode } from 'react'

import { cellBorderClasses, cellTextClass } from './editor'
import { EMPTY, formatValue, type SudokuGrid, type SudokuSolution } from './model'

type SudokuSolutionViewProps = {
  grid: SudokuGrid
  solution: SudokuSolution
}

/**
 * The solved cells carry the weight: they are what the user came for, and the givens are already
 * on the page in front of them. Distinguished by weight rather than colour, so the distinction
 * survives greyscale, colour-blindness, and the gray-only palette.
 */
export function SudokuSolutionView({ grid, solution }: SudokuSolutionViewProps): ReactNode {
  const { n } = grid

  return (
    <div
      role="grid"
      aria-label="Solved Sudoku grid"
      className="mx-auto grid w-full max-w-md"
      style={{ gridTemplateColumns: `repeat(${String(n)}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: n * n }, (_, cell) => {
        const row = Math.floor(cell / n)
        const col = cell % n
        const value = solution.values[cell] ?? EMPTY
        const isGiven = (grid.values[cell] ?? EMPTY) !== EMPTY

        return (
          <div
            key={cell}
            role="gridcell"
            aria-label={`Row ${String(row + 1)}, column ${String(col + 1)}, ${formatValue(value)}${
              isGiven ? ', given' : ', solved'
            }`}
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
  )
}
