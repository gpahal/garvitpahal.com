import { allDifferent } from '@/lib/csp/all-different'
import { bitOf, fullMask } from '@/lib/csp/bitset'
import { solveCsp } from '@/lib/csp/search'
import { columnGroups, rowGroups } from '@/lib/grid/geometry'
import { toSolveResult } from '@/puzzles/solve-result'
import type { SolveOptions, SolveResult } from '@/puzzles/types'

import { EMPTY, type SudokuGrid, type SudokuSolution } from './model'

/** Regions are stored per cell, so the groups are read off the map rather than derived from boxes. */
function regionGroups(grid: SudokuGrid): Array<Uint16Array> {
  const byRegion = new Map<number, Array<number>>()
  for (let cell = 0; cell < grid.n * grid.n; cell++) {
    const region = grid.regions[cell] ?? 0
    const bucket = byRegion.get(region)
    if (bucket) {
      bucket.push(cell)
    } else {
      byRegion.set(region, [cell])
    }
  }
  return Array.from(byRegion.values(), (cells) => Uint16Array.from(cells))
}

export function solveSudoku(grid: SudokuGrid, options: SolveOptions): SolveResult<SudokuSolution> {
  const { n } = grid

  const domains = new Uint32Array(n * n).fill(fullMask(n))
  for (let cell = 0; cell < grid.values.length; cell++) {
    const value = grid.values[cell] ?? EMPTY
    if (value !== EMPTY) {
      domains[cell] = bitOf(value)
    }
  }

  const outcome = solveCsp(domains, {
    valueCount: n,
    propagators: [allDifferent([...rowGroups(n), ...columnGroups(n), ...regionGroups(grid)], n)],
    solutionLimit: 2,
    deadline: Date.now() + options.timeoutMs,
  })

  return toSolveResult(outcome, (values) => ({ values }))
}
