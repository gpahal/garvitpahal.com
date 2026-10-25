import { pluralize } from '@/lib/text'

import { describeCell } from '../../grid/geometry'
import { connectedComponents } from '../../grid/regions'
import { isCageArityValid, isClueSatisfied } from './cage-math'
import { cellsByCage } from './model'
import type { Cage, KenKenGrid } from './model'

type CageIssue = 'split' | 'unset' | 'arity' | 'out_of_range'

/**
 * Most important first. `cells` are passed in because callers ask of every cage, and `cellsByCage`
 * finds them all in one pass.
 */
export function cageIssue(
  grid: KenKenGrid,
  cageId: number,
  cells: Array<number>,
): CageIssue | undefined {
  const cage: Cage | undefined = grid.cages[cageId]
  if (!cage) {
    return undefined
  }

  if (connectedComponents(grid.n, cells).length > 1) {
    return 'split'
  }
  if (!isCageArityValid(cage.op, cells.length)) {
    return 'arity'
  }
  if (cage.target === 0) {
    return 'unset'
  }
  return isTargetReachable(cage, grid.n, cells.length) ? undefined : 'out_of_range'
}

function hasFactorsUpTo(value: number, n: number): boolean {
  let rest = value
  for (let factor = 2; factor <= n; factor++) {
    while (rest % factor === 0) {
      rest /= factor
    }
  }
  return rest === 1
}

function isMetByPair(cage: Cage, n: number): boolean {
  for (let low = 1; low < n; low++) {
    for (let high = low + 1; high <= n; high++) {
      if (isClueSatisfied([low, high], cage)) {
        return true
      }
    }
  }
  return false
}

/**
 * Called once the arity fits. A connected two-cell cage shares a line, so its values differ and
 * trying every such pair is exact; a larger cage gets bounds.
 */
function isTargetReachable(cage: Cage, n: number, cellCount: number): boolean {
  const { op, target } = cage
  if (target < 0) {
    return false
  }
  if (cellCount === 2) {
    return isMetByPair(cage, n)
  }
  switch (op) {
    case '=': {
      return target <= n
    }
    case '+': {
      return target >= cellCount && target <= n * cellCount
    }
    case '*': {
      return target <= n ** cellCount && hasFactorsUpTo(target, n)
    }
    // These fit only two cells, which `isMetByPair` has answered.
    case '-':
    case '/': {
      return false
    }
  }
}

export type MarkedCageIssue = Exclude<CageIssue, 'unset'>

/**
 * Lower-cased, so it reads both on its own and appended to a cell's `aria-label`.
 */
export function describeCageIssue(issue: MarkedCageIssue): string {
  switch (issue) {
    case 'split': {
      return 'this cage is in two separate pieces'
    }
    case 'arity': {
      return 'this operator does not fit a cage this size'
    }
    case 'out_of_range': {
      return 'this clue is out of range'
    }
  }
}

/**
 * Each cage on its own; how cages combine is the solver's. `unset` is counted by
 * `findCagesMissingClue` instead, since a hand-entered grid starts entirely unset.
 */
function cageIssuesIn(grid: KenKenGrid, cells: Array<Array<number>>): Map<number, MarkedCageIssue> {
  const issues = new Map<number, MarkedCageIssue>()
  for (const cageId of grid.cages.keys()) {
    const issue = cageIssue(grid, cageId, cells[cageId] ?? [])
    if (issue && issue !== 'unset') {
      issues.set(cageId, issue)
    }
  }
  return issues
}

export function findCageIssues(grid: KenKenGrid): Map<number, MarkedCageIssue> {
  return cageIssuesIn(grid, cellsByCage(grid))
}

/**
 * In reading order, since compaction numbers cages row-major.
 */
function findCagesMissingClue(grid: KenKenGrid): Array<number> {
  return grid.cages.flatMap((cage, cageId) => (cage.target === 0 ? cageId : []))
}

function locate(
  grid: KenKenGrid,
  cageIds: Array<number>,
  marker: string,
  cells: Array<Array<number>>,
): string {
  const only = cageIds.length === 1 ? cells[cageIds[0] ?? 0]?.[0] : undefined
  return only === undefined
    ? `each marked ${marker} in the grid`
    : `marked ${marker} at ${describeCell(grid.n, only).toLowerCase()}`
}

/**
 * The only place a whole-grid complaint is worded; the editor only draws the `!` and `?` it points
 * at.
 */
export function findSolveBlocker(grid: KenKenGrid): string | undefined {
  const cells = cellsByCage(grid)

  const issues = [...cageIssuesIn(grid, cells).keys()]
  if (issues.length > 0) {
    return `${pluralize(issues.length, 'cage')} ${
      issues.length === 1 ? 'is' : 'are'
    } not valid yet, ${locate(grid, issues, '!', cells)}`
  }

  const missing = findCagesMissingClue(grid)
  return missing.length > 0
    ? `${pluralize(missing.length, 'cage')} still ${
        missing.length === 1 ? 'needs' : 'need'
      } a clue, ${locate(grid, missing, '?', cells)}`
    : undefined
}
