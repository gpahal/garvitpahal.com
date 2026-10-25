import { bitOf } from '../../csp/bitset'
import { boxGroups } from '../../grid/geometry'
import { openDomains, solveLatinSquare } from '../../grid/latin-square'
import { solveDeadline } from '../solve-result'
import type { SolveOptions, SolveResult } from '../types'
import { EMPTY } from './model'
import type { SudokuGrid } from './model'

export function solveSudoku(grid: SudokuGrid, options: SolveOptions): SolveResult {
  const clock = solveDeadline(options)
  const { n } = grid

  const domains = openDomains(n)
  for (let cell = 0; cell < grid.values.length; cell++) {
    const value = grid.values[cell] ?? EMPTY
    if (value !== EMPTY) {
      domains[cell] = bitOf(value)
    }
  }

  return solveLatinSquare(n, domains, {
    ...clock,
    groups: boxGroups(n, grid.boxWidth, grid.boxHeight),
  })
}
