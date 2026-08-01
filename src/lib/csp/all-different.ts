import { bitOf, isSingleBit } from './bitset'
import type { Domains, PropagationResult, Propagator } from './domains'

/** Removes a decided variable's value from every variable sharing a group with it. */
function eliminateFromPeers(domains: Domains, peers: Uint16Array, mask: number): PropagationResult {
  let result: PropagationResult = 'stable'
  for (const peer of peers) {
    const current = domains[peer]!
    if ((current & mask) !== 0) {
      const next = current & ~mask
      if (next === 0) {
        return 'contradiction'
      }
      domains[peer] = next
      result = 'changed'
    }
  }
  return result
}

/** Naked singles: a variable with one value left forbids it everywhere it is a peer. */
function propagateNakedSingles(domains: Domains, peers: Array<Uint16Array>): PropagationResult {
  let result: PropagationResult = 'stable'
  for (const [variable, mask] of domains.entries()) {
    if (mask === 0) {
      return 'contradiction'
    }
    if (!isSingleBit(mask)) {
      continue
    }
    const eliminated = eliminateFromPeers(domains, peers[variable] ?? EMPTY_PEERS, mask)
    if (eliminated === 'contradiction') {
      return 'contradiction'
    }
    if (eliminated === 'changed') {
      result = 'changed'
    }
  }
  return result
}

/** How many variables in a group could still hold `bit`, and the last one seen. */
function countHomes(
  domains: Domains,
  group: Uint16Array,
  bit: number,
): { count: number; last: number } {
  let count = 0
  let last = -1
  for (const variable of group) {
    if ((domains[variable]! & bit) === 0) {
      continue
    }
    count++
    last = variable
  }
  return { count, last }
}

function propagateHiddenSinglesInGroup(
  domains: Domains,
  group: Uint16Array,
  valueCount: number,
): PropagationResult {
  let result: PropagationResult = 'stable'

  for (let value = 1; value <= valueCount; value++) {
    const bit = bitOf(value)
    const { count, last } = countHomes(domains, group, bit)
    // A group is as wide as its value range, so a value with nowhere to go cannot be placed.
    if (count === 0) {
      return 'contradiction'
    }
    if (count === 1 && domains[last]! !== bit) {
      domains[last] = bit
      result = 'changed'
    }
  }

  return result
}

/** Hidden singles: a value with only one possible home in a group belongs there. */
function propagateHiddenSingles(
  domains: Domains,
  groups: Array<Uint16Array>,
  valueCount: number,
): PropagationResult {
  let result: PropagationResult = 'stable'
  for (const group of groups) {
    const propagated = propagateHiddenSinglesInGroup(domains, group, valueCount)
    if (propagated === 'contradiction') {
      return 'contradiction'
    }
    if (propagated === 'changed') {
      result = 'changed'
    }
  }
  return result
}

const EMPTY_PEERS = new Uint16Array(0)

/**
 * The variables in each group must take pairwise distinct values. A group is just a list of variable
 * indices - it does not know whether it happens to be a row, a column, a box or something with no
 * geometry at all.
 *
 * Peers are precomputed once here rather than per call, since the search runs this on every node.
 * Hidden singles assume each group is exactly `valueCount` variables wide, which is what makes
 * "nowhere to put this value" a contradiction rather than merely uninformative.
 */
export function allDifferent(groups: Array<Uint16Array>, valueCount: number): Propagator {
  let variableCount = 0
  for (const group of groups) {
    for (const variable of group) {
      variableCount = Math.max(variableCount, variable + 1)
    }
  }

  const peerSets: Array<Set<number>> = Array.from(
    { length: variableCount },
    () => new Set<number>(),
  )
  for (const group of groups) {
    for (const variable of group) {
      const set = peerSets[variable]!
      for (const other of group) {
        if (other !== variable) {
          set.add(other)
        }
      }
    }
  }
  const peers = peerSets.map((set) => Uint16Array.from(set))

  const isExact = groups.every((group) => group.length === valueCount)

  return (domains) => {
    const naked = propagateNakedSingles(domains, peers)
    if (naked === 'contradiction') {
      return 'contradiction'
    }
    if (!isExact) {
      return naked
    }
    const hidden = propagateHiddenSingles(domains, groups, valueCount)
    if (hidden === 'contradiction') {
      return 'contradiction'
    }
    return naked === 'changed' || hidden === 'changed' ? 'changed' : 'stable'
  }
}
