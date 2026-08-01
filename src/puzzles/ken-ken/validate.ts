import { colOf, rowOf } from '@/lib/grid/geometry'
import { connectedComponents } from '@/lib/grid/regions'
import { pluralize } from '@/lib/x/text'

import { isCageArityValid } from './cage-math'
import { cageAnchor, cageCellCount, cageCells, type Cage, type KenKenGrid } from './model'

export type CageIssue = 'split' | 'unset' | 'arity' | 'out_of_range'

/** Why a cage is wrong, in the order the message should prefer. `undefined` means it is fine. */
export function cageIssue(grid: KenKenGrid, cageId: number): CageIssue | undefined {
  const cage: Cage | undefined = grid.cages[cageId]
  if (!cage) {
    return undefined
  }

  const cells = cageCells(grid, cageId)
  if (cells.length === 0) {
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
  // A given cannot exceed the largest value the grid holds, and no clue can be negative.
  if (cage.target < 0 || (cage.op === '=' && cage.target > grid.n)) {
    return 'out_of_range'
  }

  return undefined
}

/** An issue the grid marks with a `!`. `unset` is not one of them - see `findCageIssues`. */
export type MarkedCageIssue = Exclude<CageIssue, 'unset'>

/** Lower-cased, so it reads both on its own and appended to a cell's `aria-label`. */
export function describeCageIssue(issue: MarkedCageIssue): string {
  switch (issue) {
    case 'split': {
      return 'this cage is in two separate pieces'
    }
    case 'arity': {
      return 'this operator does not fit a cage this size'
    }
    default: {
      return 'this clue is out of range'
    }
  }
}

/**
 * Cage ids the grid should mark as wrong.
 *
 * `unset` is deliberately left out: a cage with no clue already shows nothing in its corner, so
 * marking it as well says nothing new - and on a grid being entered by hand every cage starts unset,
 * which would paint the whole thing as an error before the user had done anything.
 * `countCagesMissingClue` reports those as a running total instead.
 *
 * Structural problems only. Whether the arithmetic is achievable is left to the solver, whose
 * `unsolvable` result is the existing oracle for a misread and already has copy explaining it.
 */
export function findCageIssues(grid: KenKenGrid): Map<number, MarkedCageIssue> {
  const issues = new Map<number, MarkedCageIssue>()
  for (const cageId of grid.cages.keys()) {
    const issue = cageIssue(grid, cageId)
    if (issue && issue !== 'unset') {
      issues.set(cageId, issue)
    }
  }
  return issues
}

/**
 * Cage ids with no clue yet, in reading order - cage ids come out of compaction in order of first
 * appearance, which is row-major. That order is what lets `findSolveBlocker` name the first one.
 *
 * A cage with no cells is skipped, matching `cageIssue` and the solver: it has no corner to mark.
 */
export function findCagesMissingClue(grid: KenKenGrid): Array<number> {
  const missing: Array<number> = []
  for (const [cageId, cage] of grid.cages.entries()) {
    if (cage.target === 0 && cageCellCount(grid, cageId) > 0) {
      missing.push(cageId)
    }
  }
  return missing
}

/**
 * Where to look for the cages a message is about. A single one is worth pointing straight at; past
 * that the markers in the grid do the finding.
 *
 * One cage always has an anchor - both callers skip cages with no cells, which are the only ones
 * `cageAnchor` cannot place - so the plural wording is never reached with a count of one.
 */
function locate(grid: KenKenGrid, cageIds: Array<number>, marker: string): string {
  const only = cageIds.length === 1 ? cageAnchor(grid, cageIds[0]!) : undefined
  return only === undefined
    ? `each marked ${marker} in the grid`
    : `marked ${marker} at row ${String(rowOf(grid.n, only) + 1)}, column ${String(colOf(grid.n, only) + 1)}`
}

/**
 * Why solving this grid would not mean anything yet, or `undefined` when it would.
 *
 * A cage with no clue constrains nothing, so the solver would answer a puzzle looser than the one on
 * the page and report `multiple` - true, but about a puzzle the user never described, and it reads
 * as "your photo was misread" when the real answer is "you have not finished typing it in". A cage
 * that is structurally wrong is worse: its arithmetic is applied to a shape the puzzle does not have.
 *
 * This is the only place a whole-grid complaint is worded. The editor renders the `!` and `?` these
 * point at and nothing else, so the same fact is never on screen twice in two wordings.
 */
export function findSolveBlocker(grid: KenKenGrid): string | undefined {
  const issues = findCageIssues(grid).keys().toArray()
  if (issues.length > 0) {
    return `${pluralize(issues.length, 'cage')} ${
      issues.length === 1 ? 'is' : 'are'
    } not valid yet, ${locate(grid, issues, '!')}`
  }

  const missing = findCagesMissingClue(grid)
  if (missing.length > 0) {
    return `${pluralize(missing.length, 'cage')} still ${
      missing.length === 1 ? 'needs' : 'need'
    } a clue, ${locate(grid, missing, '?')}`
  }

  return undefined
}
