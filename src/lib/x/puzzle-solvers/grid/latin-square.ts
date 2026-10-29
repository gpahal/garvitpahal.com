import { allDifferent } from '../csp/all-different'
import { bitOf, fullMask, lowestBitValue, popCount } from '../csp/bitset'
import { propagateToFixedPoint } from '../csp/domains'
import type { Domains, Propagator } from '../csp/domains'
import type { SolveResult } from '../puzzles/types'
import { columnGroups, rowGroups } from './geometry'

export function openDomains(n: number): Uint32Array {
  return new Uint32Array(n * n).fill(fullMask(n))
}

/**
 * Two tell a unique solution from an ambiguous one.
 */
const SOLUTION_LIMIT = 2

/**
 * Checked once per node, not inside propagation, so a node may run a few milliseconds past the
 * deadline.
 */
class SearchTimeout extends Error {}

type LatinSquareConfig = {
  deadline: number
  now: () => number
  /**
   * Beyond the rows and columns, each `n` cells wide.
   */
  groups?: Array<Uint16Array>
  propagators?: Array<Propagator>
  /**
   * For constraints too expensive to propagate. Without it, a constraint left out of `propagators`
   * is not enforced.
   */
  isSolution?: (values: Uint8Array) => boolean
}

type SearchState = {
  n: number
  deadline: number
  now: () => number
  propagators: Array<Propagator>
  isSolution: ((values: Uint8Array) => boolean) | undefined
  solutions: Array<Uint8Array>
  /**
   * Per variable, one plus the number of failed subtrees that branching on it led to.
   */
  weights: Float64Array
  failures: number
}

function toValues(domains: Domains): Uint8Array {
  const values = new Uint8Array(domains.length)
  for (const [variable, mask] of domains.entries()) {
    values[variable] = lowestBitValue(mask)
  }
  return values
}

function search(domains: Domains, state: SearchState): void {
  if (state.solutions.length >= SOLUTION_LIMIT) {
    return
  }

  if (state.now() >= state.deadline) {
    throw new SearchTimeout()
  }
  if (propagateToFixedPoint(domains, state.propagators) === 'contradiction') {
    state.failures++
    return
  }

  // Like dom/wdeg, but weighting failed subtrees per variable rather than failures per constraint.
  // Plain minimum-remaining-values thrashed on sparse grids this settles at once.
  let bestVariable = -1
  let bestScore = Infinity
  const variableCount = domains.length
  for (let variable = 0; variable < variableCount; variable++) {
    const domain = domains[variable] ?? 0
    const count = popCount(domain)
    if (count <= 1) {
      continue
    }
    const score = count / (state.weights[variable] ?? 1)
    if (!(score < bestScore)) {
      continue
    }

    bestVariable = variable
    bestScore = score
  }

  if (bestVariable === -1) {
    const values = toValues(domains)
    if (!state.isSolution || state.isSolution(values)) {
      state.solutions.push(values)
    }
    return
  }

  const mask = domains[bestVariable] ?? 0
  for (let value = 1; value <= state.n; value++) {
    const bit = bitOf(value)
    if ((mask & bit) === 0) {
      continue
    }
    const next = Uint32Array.from(domains)
    next[bestVariable] = bit
    const failuresBefore = state.failures
    search(next, state)
    if (state.failures > failuresBefore) {
      state.weights[bestVariable] = (state.weights[bestVariable] ?? 1) + 1
    }
    if (state.solutions.length >= SOLUTION_LIMIT) {
      return
    }
  }
}

/**
 * `domains` is consumed, so pass a copy if the caller still needs it.
 */
export function solveLatinSquare(
  n: number,
  domains: Domains,
  { deadline, now, groups = [], propagators = [], isSolution }: LatinSquareConfig,
): SolveResult {
  const state: SearchState = {
    n,
    deadline,
    now,
    propagators: [
      allDifferent([...rowGroups(n), ...columnGroups(n), ...groups], n),
      ...propagators,
    ],
    isSolution,
    solutions: [],
    weights: new Float64Array(domains.length).fill(1),
    failures: 0,
  }
  let isTimedOut = false
  try {
    search(domains, state)
    // Only interrupted work is timed out; the last node may finish a proof after the deadline.
  } catch (error) {
    if (!(error instanceof SearchTimeout)) throw error
    isTimedOut = true
  }

  const [first, second] = state.solutions
  if (!first) {
    return { status: isTimedOut ? 'timeout' : 'unsolvable' }
  }
  return second
    ? { status: 'multiple', solution: first }
    : { status: 'solved', solution: first, isUnique: !isTimedOut }
}
