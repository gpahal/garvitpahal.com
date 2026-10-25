import { bitOf, isSingleBit } from './bitset'
import { narrow, propagateEach } from './domains'
import type { Domains, PropagationResult, Propagator } from './domains'

function propagateNakedSingles(domains: Domains, peers: Array<Uint16Array>): PropagationResult {
  return propagateEach(domains.keys(), (variable) => {
    const mask = domains[variable] ?? 0
    if (mask === 0) {
      return 'contradiction'
    }
    if (!isSingleBit(mask)) {
      return 'stable'
    }
    return propagateEach(peers[variable] ?? EMPTY_PEERS, (peer) => {
      const current = domains[peer] ?? 0
      return (current & mask) === 0 ? 'stable' : narrow(domains, peer, (current & ~mask) >>> 0)
    })
  })
}

/**
 * A value with nowhere to go in a group is a contradiction, since a group is as wide as its value
 * range.
 */
function propagateHiddenSingles(
  domains: Domains,
  groups: Array<Uint16Array>,
  values: Array<number>,
): PropagationResult {
  return propagateEach(groups, (group) =>
    propagateEach(values, (value) => {
      const bit = bitOf(value)
      let count = 0
      let last = -1
      for (const variable of group) {
        if (((domains[variable] ?? 0) & bit) === 0) {
          continue
        }

        count++
        last = variable
      }
      if (count === 0) {
        return 'contradiction'
      }
      return count === 1 ? narrow(domains, last, bit) : 'stable'
    }),
  )
}

const EMPTY_PEERS = new Uint16Array(0)

/**
 * Every group must be exactly `valueCount` variables wide: hidden singles treat a value with
 * nowhere to go as a contradiction, so a narrower group would refuse valid assignments.
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
      const set = peerSets[variable]
      for (const other of group) {
        if (other !== variable) {
          set?.add(other)
        }
      }
    }
  }
  const peers = peerSets.map((set) => Uint16Array.from(set))
  const values = Array.from({ length: valueCount }, (_, index) => index + 1)
  const passes: Array<Propagator> = [
    (domains) => propagateNakedSingles(domains, peers),
    (domains) => propagateHiddenSingles(domains, groups, values),
  ]

  return (domains) => propagateEach(passes, (pass) => pass(domains))
}
