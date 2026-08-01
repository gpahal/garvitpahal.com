/**
 * One bitmask per variable. `Uint32Array` rather than 16 bits so the engine tops out at 32 values
 * rather than at the largest grid any current puzzle happens to use.
 */
export type Domains = Uint32Array

/** A union rather than a boolean, so `contradiction` reads explicitly at every call site. */
export type PropagationResult = 'changed' | 'stable' | 'contradiction'

/**
 * Narrows `domains` in place. Must never widen one: the search relies on propagation being
 * monotonic to backtrack by restoring a snapshot.
 */
export type Propagator = (domains: Domains) => PropagationResult

/**
 * Runs every propagator until a full pass changes nothing. One loop however many rules a puzzle
 * brings, so rules that feed each other reach a fixed point rather than needing a fixed order.
 */
export function propagateToFixedPoint(
  domains: Domains,
  propagators: Array<Propagator>,
): PropagationResult {
  let hasEverChanged = false

  for (;;) {
    let hasChanged = false
    for (const propagate of propagators) {
      const result = propagate(domains)
      if (result === 'contradiction') {
        return 'contradiction'
      }
      if (result === 'changed') {
        hasChanged = true
      }
    }
    if (!hasChanged) {
      return hasEverChanged ? 'changed' : 'stable'
    }
    hasEverChanged = true
  }
}
