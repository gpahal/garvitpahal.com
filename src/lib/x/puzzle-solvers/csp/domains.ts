/**
 * One bitmask per variable, of at most 32 values (`bitset.ts`).
 */
export type Domains = Uint32Array

export type PropagationResult = 'changed' | 'stable' | 'contradiction'

/**
 * Narrows in place and never widens: each branch searches its own copy, so nothing is undone. Takes
 * no deadline, so one pass may run past it.
 */
export type Propagator = (domains: Domains) => PropagationResult

/**
 * Every rule merges its results here: losing a contradiction silently lets a dead branch through,
 * and `stable` after narrowing stops short of the fixed point.
 */
export function propagateEach<T>(
  items: Iterable<T>,
  propagate: (item: T) => PropagationResult,
): PropagationResult {
  let result: PropagationResult = 'stable'
  for (const item of items) {
    const propagated = propagate(item)
    if (propagated === 'contradiction') {
      return 'contradiction'
    }
    if (propagated === 'changed') {
      result = 'changed'
    }
  }
  return result
}

/**
 * `next` must be a subset of the domain, as an unsigned mask.
 */
export function narrow(domains: Domains, variable: number, next: number): PropagationResult {
  if (next === 0) {
    return 'contradiction'
  }
  if (next === domains[variable]) {
    return 'stable'
  }
  domains[variable] = next
  return 'changed'
}

export function propagateToFixedPoint(
  domains: Domains,
  propagators: Array<Propagator>,
): PropagationResult {
  let hasEverChanged = false
  for (;;) {
    const result = propagateEach(propagators, (propagate) => propagate(domains))
    if (result !== 'changed') {
      return result === 'stable' && hasEverChanged ? 'changed' : result
    }
    hasEverChanged = true
  }
}
