import type { SearchOutcome } from '@/lib/csp/search'

import type { SolveResult } from './types'

/**
 * The one place a search outcome becomes a `SolveResult`, because this mapping is the oracle the
 * extraction pipeline escalates on: `multiple` has to stay reachable, and `timeout` has to stay
 * distinct from `unsolvable` so a slow puzzle is not reported as a misread.
 *
 * Assumes the search ran with `solutionLimit` of at least 2.
 */
export function toSolveResult<TSolution>(
  outcome: SearchOutcome,
  toSolution: (values: Uint8Array) => TSolution,
): SolveResult<TSolution> {
  const [first] = outcome.solutions

  if (outcome.solutions.length >= 2) {
    return { status: 'multiple', solution: toSolution(first!) }
  }
  if (first) {
    // The search keeps going after the first solution precisely to find a second, so running out of
    // time here proves nothing about uniqueness. Still worth returning - the solution is real.
    return { status: 'solved', solution: toSolution(first), isUnique: !outcome.isTimedOut }
  }
  // A completed search with no solution means the givens contradict each other, which in practice
  // means the puzzle was read wrong.
  return outcome.isTimedOut ? { status: 'timeout' } : { status: 'unsolvable' }
}
