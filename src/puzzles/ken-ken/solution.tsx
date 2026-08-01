import type { ReactNode } from 'react'

import { colOf, rowOf } from '@/lib/grid/geometry'

import { cageBorderClasses, CageClue, cellTextClass, GridFrame } from './grid-view'
import { isGivenCell, type KenKenPuzzle, type KenKenSolution } from './model'

type KenKenSolutionViewProps = {
  puzzle: KenKenPuzzle
  solution: KenKenSolution
}

/**
 * Every value is drawn identically - one colour and one weight, set once on the cell so no branch
 * can fade one of them.
 *
 * A value that was printed rather than worked out gets no visual treatment at all, because it
 * already has one: a single-cell cage prints that same number in its clue corner, so the cell says
 * so twice over. De-emphasising it as well only made a correct answer look uncertain. Screen
 * readers still hear the difference - the clue is `aria-hidden`, so the label is where they get it.
 */
export function KenKenSolutionView({ puzzle, solution }: KenKenSolutionViewProps): ReactNode {
  const { grid } = puzzle
  const { n } = grid

  return (
    <GridFrame
      n={n}
      label="Solved Ken Ken grid"
      renderCell={(cell) => {
        const value = solution.values[cell] ?? 0
        const isGiven = isGivenCell(grid, cell)

        return (
          <div
            key={cell}
            role="gridcell"
            aria-rowindex={rowOf(n, cell) + 1}
            aria-colindex={colOf(n, cell) + 1}
            aria-label={`Row ${String(rowOf(n, cell) + 1)}, column ${String(colOf(n, cell) + 1)}, ${String(value)}${
              isGiven ? ', given' : ', solved'
            }`}
            className={[
              'relative flex aspect-square items-center justify-center bg-bg font-semibold text-gray-12',
              cellTextClass(n),
              cageBorderClasses(grid, cell),
            ].join(' ')}
          >
            <CageClue grid={grid} cell={cell} />
            {value === 0 ? '' : value}
          </div>
        )
      }}
    />
  )
}
