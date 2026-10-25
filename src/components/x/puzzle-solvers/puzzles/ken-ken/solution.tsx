import type { ReactNode } from 'react'

import { cn } from 'cn'

import { cellsByCage, clueCells } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/model'
import type { KenKenPuzzle } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/model'

import { GridFrame } from '../../grid/grid-frame'
import { SolvedCell } from '../../grid/solved-cell'
import type { PuzzleSolutionProps } from '../puzzle-ui'
import { cageBorderClasses, cellTextClass } from './grid-classes'
import { CageClue } from './grid-view'

/**
 * A printed value is drawn like the rest, since its single-cell cage's clue already shows it; the
 * label still tells screen readers.
 */
export function KenKenSolutionView({
  puzzle,
  solution,
}: PuzzleSolutionProps<KenKenPuzzle>): ReactNode {
  const { grid } = puzzle
  const { n } = grid
  const byCage = cellsByCage(grid)
  const anchors = clueCells(byCage)
  // Defence in depth: Solve refuses a multi-cell `=` cage, whose cells are not printed values.
  const givens = new Set(
    byCage.flatMap((cells, cageId) =>
      cells.length === 1 && grid.cages[cageId]?.op === '=' ? cells : [],
    ),
  )

  return (
    <GridFrame
      role="table"
      n={n}
      label="Solved Ken Ken grid"
      renderCell={(cell) => {
        const value = solution[cell] ?? 0
        const isGiven = givens.has(cell)

        return (
          <SolvedCell
            key={cell}
            n={n}
            cell={cell}
            value={String(value)}
            isGiven={isGiven}
            className={cn(
              'relative font-semibold text-foreground',
              cellTextClass(n),
              cageBorderClasses(grid, cell),
            )}
          >
            <CageClue grid={grid} cell={cell} isAnchor={anchors.has(cell)} />
            {value}
          </SolvedCell>
        )
      }}
    />
  )
}
