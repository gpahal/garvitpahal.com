import { bitOf } from './bitset'
import { narrow, propagateEach } from './domains'
import type { Domains, PropagationResult, Propagator } from './domains'

export type TableConstraint = {
  variables: Uint16Array
  /**
   * Each aligned with `variables`.
   */
  tuples: Array<Uint8Array>
}

/**
 * Buffers are reused rather than allocated on every search node.
 */
type PreparedTable = {
  variables: Uint16Array
  /**
   * `arity` masks per tuple, back to back.
   */
  tupleBits: Uint32Array
  scope: Uint32Array
  support: Uint32Array
  /**
   * The scope's domains after the last pass without a contradiction. A pass is idempotent and reads
   * only the scope, so a scope still matching is consistent on any branch.
   */
  settled: Uint32Array
  hasSettled: boolean
}

function prepare({ variables, tuples }: TableConstraint): PreparedTable {
  const arity = variables.length
  const tupleBits = new Uint32Array(tuples.length * arity)
  for (const [index, tuple] of tuples.entries()) {
    for (let position = 0; position < arity; position++) {
      tupleBits[index * arity + position] = bitOf(tuple[position] ?? 0)
    }
  }
  return {
    variables,
    tupleBits,
    scope: new Uint32Array(arity),
    support: new Uint32Array(arity),
    settled: new Uint32Array(arity),
    hasSettled: false,
  }
}

/**
 * Also copies the domains into `scope`.
 */
function isScopeSettled(domains: Domains, constraint: PreparedTable): boolean {
  const { variables, scope, settled } = constraint
  const arity = variables.length
  let isSettled = constraint.hasSettled
  for (let position = 0; position < arity; position++) {
    const mask = domains[variables[position] ?? 0] ?? 0
    scope[position] = mask
    if (mask !== settled[position]) {
      isSettled = false
    }
  }
  return isSettled
}

function hasSupport(constraint: PreparedTable): boolean {
  const { tupleBits, scope, support } = constraint
  const arity = scope.length
  support.fill(0)
  let isAnySupported = false

  for (let offset = 0; offset < tupleBits.length; offset += arity) {
    let position = 0
    while (
      position < arity &&
      ((scope[position] ?? 0) & (tupleBits[offset + position] ?? 0)) !== 0
    ) {
      position++
    }
    if (position < arity) {
      continue
    }
    isAnySupported = true
    for (position = 0; position < arity; position++) {
      support[position] = (support[position] ?? 0) | (tupleBits[offset + position] ?? 0)
    }
  }

  return isAnySupported
}

function propagateConstraint(domains: Domains, constraint: PreparedTable): PropagationResult {
  if (isScopeSettled(domains, constraint)) {
    return 'stable'
  }
  if (!hasSupport(constraint)) {
    return 'contradiction'
  }

  const { variables, scope, support, settled } = constraint
  // Never a contradiction: `hasSupport` found a tuple whose every value is in `scope`.
  const result = propagateEach(variables.keys(), (position) =>
    narrow(
      domains,
      variables[position] ?? 0,
      ((scope[position] ?? 0) & (support[position] ?? 0)) >>> 0,
    ),
  )
  for (const [position, variable] of variables.entries()) {
    settled[position] = domains[variable] ?? 0
  }
  constraint.hasSettled = true
  return result
}

/**
 * Each group of variables must take one of its tuples, enforced by generalised arc consistency.
 */
export function table(constraints: Array<TableConstraint>): Propagator {
  const prepared = constraints.map(prepare)
  return (domains) =>
    propagateEach(prepared, (constraint) => propagateConstraint(domains, constraint))
}
