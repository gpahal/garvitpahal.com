import { bitOf } from './bitset'
import type { Domains, PropagationResult, Propagator } from './domains'

export type TableConstraint = {
  variables: Uint16Array
  /** Every allowed assignment, each aligned with `variables`. */
  tuples: Array<Uint8Array>
}

function isTupleSupported(domains: Domains, variables: Uint16Array, tuple: Uint8Array): boolean {
  for (const [position, variable] of variables.entries()) {
    if ((domains[variable]! & bitOf(tuple[position]!)) === 0) {
      return false
    }
  }
  return true
}

/** Values still backed by at least one supported tuple, one mask per position. */
function collectSupport(domains: Domains, constraint: TableConstraint): Uint32Array | undefined {
  const { variables, tuples } = constraint
  const support = new Uint32Array(variables.length)
  let hasSupport = false

  for (const tuple of tuples) {
    if (!isTupleSupported(domains, variables, tuple)) {
      continue
    }
    hasSupport = true
    for (const [position] of variables.entries()) {
      support[position]! |= bitOf(tuple[position]!)
    }
  }

  return hasSupport ? support : undefined
}

function propagateConstraint(domains: Domains, constraint: TableConstraint): PropagationResult {
  const support = collectSupport(domains, constraint)
  if (!support) {
    return 'contradiction'
  }

  let result: PropagationResult = 'stable'
  for (const [position, variable] of constraint.variables.entries()) {
    // `>>> 0` because `&` yields an Int32 while the array reads back unsigned: at 32 values the two
    // would never compare equal, and this would report `changed` forever without changing anything.
    const next = (domains[variable]! & support[position]!) >>> 0
    if (next === 0) {
      return 'contradiction'
    }
    if (next !== domains[variable]) {
      domains[variable] = next
      result = 'changed'
    }
  }
  return result
}

/**
 * Extensional constraints: each listed group of variables must take one of the listed tuples.
 * Enforced by generalized arc consistency - a value survives only if some still-possible tuple uses
 * it - which is much stronger than checking the constraint once every variable is decided.
 *
 * Deliberately says nothing about where the tuples came from. A puzzle can generate them from
 * arithmetic, from a word list, or from anything else it can enumerate.
 */
export function table(constraints: Array<TableConstraint>): Propagator {
  return (domains) => {
    let result: PropagationResult = 'stable'
    for (const constraint of constraints) {
      const propagated = propagateConstraint(domains, constraint)
      if (propagated === 'contradiction') {
        return 'contradiction'
      }
      if (propagated === 'changed') {
        result = 'changed'
      }
    }
    return result
  }
}
