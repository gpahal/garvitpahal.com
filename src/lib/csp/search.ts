import { bitOf, lowestBitValue, popCount } from './bitset'
import { propagateToFixedPoint, type Domains, type Propagator } from './domains'

/** How often to consult the clock. Checking every node is measurably slower. */
const TIMEOUT_CHECK_INTERVAL = 2048

export type SearchConfig = {
  valueCount: number
  propagators: Array<Propagator>
  /**
   * Stop once this many solutions are found. Two is enough to tell a unique solution from an
   * ambiguous one, and cuts the search short on puzzles with many.
   */
  solutionLimit: number
  deadline: number
  /**
   * Final check on a complete assignment, for constraints too expensive to propagate. Without one,
   * a constraint left out of `propagators` is simply not enforced.
   */
  isSolution?: (values: Uint8Array) => boolean
}

export type SearchOutcome = {
  solutions: Array<Uint8Array>
  isTimedOut: boolean
}

type SearchState = {
  config: SearchConfig
  nodes: number
  isTimedOut: boolean
  solutions: Array<Uint8Array>
}

/** Every domain is a single bit at this point, so the lowest bit is the decided value. */
function toValues(domains: Domains): Uint8Array {
  const values = new Uint8Array(domains.length)
  for (const [variable, mask] of domains.entries()) {
    values[variable] = lowestBitValue(mask)
  }
  return values
}

function search(domains: Domains, state: SearchState): void {
  if (state.isTimedOut || state.solutions.length >= state.config.solutionLimit) {
    return
  }

  state.nodes++
  if (state.nodes % TIMEOUT_CHECK_INTERVAL === 0 && Date.now() > state.config.deadline) {
    state.isTimedOut = true
    return
  }

  if (propagateToFixedPoint(domains, state.config.propagators) === 'contradiction') {
    return
  }

  // Minimum remaining values: branching on the most constrained variable keeps the tree narrow.
  let bestVariable = -1
  let bestCount = Infinity
  for (const [variable, mask] of domains.entries()) {
    const count = popCount(mask)
    if (count > 1 && count < bestCount) {
      bestVariable = variable
      bestCount = count
      if (count === 2) {
        break
      }
    }
  }

  if (bestVariable === -1) {
    const values = toValues(domains)
    if (!state.config.isSolution || state.config.isSolution(values)) {
      state.solutions.push(values)
    }
    return
  }

  const mask = domains[bestVariable]!
  for (let value = 1; value <= state.config.valueCount; value++) {
    const bit = bitOf(value)
    if ((mask & bit) === 0) {
      continue
    }
    // Propagation mutates, so each branch gets its own copy to backtrack to.
    const next = Uint32Array.from(domains)
    next[bestVariable] = bit
    search(next, state)
    if (state.isTimedOut || state.solutions.length >= state.config.solutionLimit) {
      return
    }
  }
}

/**
 * Depth-first search with constraint propagation at every node. `initial` is consumed - pass a copy
 * if the caller still needs it.
 */
export function solveCsp(initial: Domains, config: SearchConfig): SearchOutcome {
  const state: SearchState = { config, nodes: 0, isTimedOut: false, solutions: [] }
  search(initial, state)
  return { solutions: state.solutions, isTimedOut: state.isTimedOut }
}
