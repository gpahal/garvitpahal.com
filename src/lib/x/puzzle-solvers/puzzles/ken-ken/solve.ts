import { table } from '../../csp/table'
import type { TableConstraint } from '../../csp/table'
import { openDomains, solveLatinSquare } from '../../grid/latin-square'
import { solveDeadline } from '../solve-result'
import type { SolveOptions, SolveResult } from '../types'
import { cageBounds } from './cage-bounds'
import type { BoundedCage } from './cage-bounds'
import { cageTuples, isClueSatisfied } from './cage-math'
import { cellsByCage } from './model'
import type { KenKenGrid, KenKenPuzzle } from './model'

type Cages = {
  constraints: Array<TableConstraint>
  /**
   * Cages too large to enumerate.
   */
  bounded: Array<BoundedCage>
}

function buildCages(
  grid: KenKenGrid,
  cellsOf: Array<Array<number>>,
  deadline: number,
  now: () => number,
): Cages {
  const constraints: Array<TableConstraint> = []
  const bounded: Array<BoundedCage> = []

  for (const [cageId, cage] of grid.cages.entries()) {
    const variables = Uint16Array.from(cellsOf[cageId] ?? [])
    const tuples = cageTuples(grid.n, variables, cage, deadline, now)
    // Weaker bounds rather than a truncated table, which would drop assignments that satisfy it.
    if (tuples) {
      constraints.push({ variables, tuples })
    } else {
      bounded.push({ cells: variables, cage })
    }
  }

  return { constraints, bounded }
}

export function solveKenKen(puzzle: KenKenPuzzle, options: SolveOptions): SolveResult {
  const { grid } = puzzle
  const { n } = grid

  const clock = solveDeadline(options)
  const cellsOf = cellsByCage(grid)
  const { constraints, bounded } = buildCages(grid, cellsOf, clock.deadline, clock.now)

  return solveLatinSquare(n, openDomains(n), {
    ...clock,
    propagators: [table(constraints), cageBounds(n, bounded)],
    // Keeps the answer correct whatever propagation managed to prove.
    isSolution: (values) =>
      grid.cages.every((cage, cageId) =>
        isClueSatisfied(
          (cellsOf[cageId] ?? []).map((cell) => values[cell] ?? 0),
          cage,
        ),
      ),
  })
}
