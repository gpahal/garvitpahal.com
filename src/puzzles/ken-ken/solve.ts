import { allDifferent } from '@/lib/csp/all-different'
import { fullMask } from '@/lib/csp/bitset'
import { solveCsp } from '@/lib/csp/search'
import { table, type TableConstraint } from '@/lib/csp/table'
import { columnGroups, rowGroups } from '@/lib/grid/geometry'
import { toSolveResult } from '@/puzzles/solve-result'
import type { SolveOptions, SolveResult } from '@/puzzles/types'

import { cageTuples, isClueSatisfied } from './cage-math'
import { cageCells, type KenKenGrid, type KenKenPuzzle, type KenKenSolution } from './model'

type Cages = {
  cells: Array<Uint16Array>
  constraints: Array<TableConstraint>
}

function buildCages(grid: KenKenGrid, deadline: number): Cages {
  const cells: Array<Uint16Array> = []
  const constraints: Array<TableConstraint> = []

  for (const [cageId, cage] of grid.cages.entries()) {
    const variables = Uint16Array.from(cageCells(grid, cageId))
    cells.push(variables)
    // Compaction drops empty cages, so this is belt and braces - but an empty one would enumerate to
    // no tuples at all and report the whole puzzle unsolvable, which is far from the real problem.
    if (variables.length === 0) {
      continue
    }
    const tuples = cageTuples(grid.n, variables, cage, deadline)
    // An unenumerable cage is left out of propagation rather than approximated. `isSolution` still
    // checks it, so leaving it out costs search time but never correctness.
    if (tuples) {
      constraints.push({ variables, tuples })
    }
  }

  return { cells, constraints }
}

export function solveKenKen(
  puzzle: KenKenPuzzle,
  options: SolveOptions,
): SolveResult<KenKenSolution> {
  const { grid } = puzzle
  const { n } = grid

  // One deadline for the whole solve. Enumerating cages is itself a search, so giving it its own
  // budget would let a pathological cage spend time on top of `timeoutMs` rather than out of it.
  const deadline = Date.now() + options.timeoutMs
  const { cells, constraints } = buildCages(grid, deadline)

  const outcome = solveCsp(new Uint32Array(n * n).fill(fullMask(n)), {
    valueCount: n,
    // Rows and columns only: Ken Ken is a Latin square with arithmetic on top, and has no boxes.
    propagators: [allDifferent([...rowGroups(n), ...columnGroups(n)], n), table(constraints)],
    solutionLimit: 2,
    deadline,
    // The backstop that keeps the answer correct whatever propagation managed to prove.
    isSolution: (values) =>
      grid.cages.every((cage, cageId) => {
        const variables = cells[cageId]!
        return (
          variables.length === 0 ||
          isClueSatisfied(
            Array.from(variables, (cell) => values[cell]!),
            cage,
          )
        )
      }),
  })

  return toSolveResult(outcome, (values) => ({ values }))
}
