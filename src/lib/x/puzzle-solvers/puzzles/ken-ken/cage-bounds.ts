import {
  bitOf,
  highestBitValue,
  isSingleBit,
  lowestBitValue,
  popCount,
  rangeMask,
} from '../../csp/bitset'
import { narrow, propagateEach } from '../../csp/domains'
import type { Domains, PropagationResult, Propagator } from '../../csp/domains'
import { colOf, rowOf } from '../../grid/geometry'
import { isClueSatisfied } from './cage-math'
import type { Cage } from './model'

export type BoundedCage = {
  cells: Uint16Array
  cage: Cage
}

/**
 * Each segment lies along one line. `smallest` and `largest` are scratch, reused on every node the
 * search visits.
 */
type SumCage = {
  target: number
  segments: Array<Uint16Array>
  smallest: Uint8Array
  largest: Uint8Array
}

/**
 * By row or by column, whichever makes fewer groups: longer segments give tighter bounds.
 */
function lineSegments(n: number, cells: Uint16Array): Array<Uint16Array> {
  const byRow = new Map<number, Array<number>>()
  const byColumn = new Map<number, Array<number>>()
  for (const cell of cells) {
    for (const [groups, line] of [
      [byRow, rowOf(n, cell)],
      [byColumn, colOf(n, cell)],
    ] as const) {
      const group = groups.get(line)
      if (group) {
        group.push(cell)
      } else {
        groups.set(line, [cell])
      }
    }
  }
  const groups = byColumn.size < byRow.size ? byColumn : byRow
  return Array.from(groups.values(), (group) => Uint16Array.from(group))
}

/**
 * Stores the last value taken in `kth[index]`. `mask` holds at least `k` values.
 */
function extremeSum(
  mask: number,
  k: number,
  isFromTop: boolean,
  kth: Uint8Array,
  index: number,
): number {
  let rest = mask
  let sum = 0
  for (let taken = 0; taken < k; taken++) {
    const value = isFromTop ? highestBitValue(rest) : lowestBitValue(rest)
    sum += value
    kth[index] = value
    rest = (rest & ~bitOf(value)) >>> 0
  }
  return sum
}

/**
 * Cells in one segment share a line, so they take distinct values: `k` of them sum to at least the
 * `k` smallest values any allows and at most the `k` largest. Counted apart, a clue out of reach
 * would survive until nearly every cell is decided. A value raises the least sum only by its excess
 * over the segment's `k`th smallest, and lowers the greatest by its shortfall under the `k`th
 * largest.
 */
function propagateSum(domains: Domains, cage: SumCage): PropagationResult {
  const { segments, target, smallest, largest } = cage
  let low = 0
  let high = 0
  for (const [index, segment] of segments.entries()) {
    const size = segment.length
    let union = 0
    for (let position = 0; position < size; position++) {
      union |= domains[segment[position] ?? 0] ?? 0
    }
    if (popCount(union >>> 0) < size) {
      return 'contradiction'
    }
    low += extremeSum(union >>> 0, size, false, smallest, index)
    high += extremeSum(union >>> 0, size, true, largest, index)
  }
  if (target < low || target > high) {
    return 'contradiction'
  }

  return propagateEach(segments.entries(), ([index, segment]) => {
    const allowed = rangeMask(
      (largest[index] ?? 0) - (high - target),
      (smallest[index] ?? 0) + (target - low),
    )
    return propagateEach(segment, (cell) =>
      narrow(domains, cell, ((domains[cell] ?? 0) & allowed) >>> 0),
    )
  })
}

function divisorsIn(domain: number, quotient: number): number {
  let divisors = 0
  for (let rest = domain; rest !== 0; rest &= rest - 1) {
    const value = lowestBitValue(rest)
    if (quotient % value === 0) {
      divisors |= rest & -rest
    }
  }
  return divisors >>> 0
}

/**
 * Each undecided cell must divide what the decided ones leave of the target. `low` and `decided` are
 * divided only once known not to exceed the safe-integer target, so they stay exact. Past
 * `Number.MAX_SAFE_INTEGER` a rounded `high` still compares right, but the lower bounds divide by it
 * only while it is exact, since a rounded one could cut a value that fits.
 */
function propagateProduct(domains: Domains, cells: Uint16Array, target: number): PropagationResult {
  const count = cells.length
  let low = 1
  let high = 1
  let decided = 1
  for (let position = 0; position < count; position++) {
    const domain = domains[cells[position] ?? 0] ?? 0
    low *= lowestBitValue(domain)
    high *= highestBitValue(domain)
    if (isSingleBit(domain)) {
      decided *= lowestBitValue(domain)
    }
  }
  if (target < low || target > high || target % decided !== 0) {
    return 'contradiction'
  }

  const left = target / decided
  const isHighExact = high <= Number.MAX_SAFE_INTEGER
  return propagateEach(cells, (cell) => {
    const domain = domains[cell] ?? 0
    if (isSingleBit(domain)) {
      return 'stable'
    }
    const othersLow = low / lowestBitValue(domain)
    const least = isHighExact ? Math.ceil(target / (high / highestBitValue(domain))) : 1
    const inRange = rangeMask(least, Math.floor(target / othersLow))
    return narrow(domains, cell, divisorsIn(domain & inRange, left))
  })
}

function isAllDecided(domains: Domains, cells: Uint16Array, scratch: Uint8Array): boolean {
  const count = cells.length
  for (let position = 0; position < count; position++) {
    const domain = domains[cells[position] ?? 0] ?? 0
    if (!isSingleBit(domain)) {
      return false
    }
    scratch[position] = lowestBitValue(domain)
  }
  return true
}

/**
 * For cages too large to enumerate into a table: without bounds, a clue no assignment can meet
 * leaves the search trying every grid until the deadline. Each cage is also checked once its last
 * cell is decided, which covers the operators with no bounds here.
 */
export function cageBounds(n: number, cages: Array<BoundedCage>): Propagator {
  // Built once, not on every node the search visits.
  const entries = cages.map(({ cells, cage }) => {
    const segments = lineSegments(n, cells)
    return {
      cells,
      cage,
      values: new Uint8Array(cells.length),
      sum: {
        target: cage.target,
        segments,
        smallest: new Uint8Array(segments.length),
        largest: new Uint8Array(segments.length),
      } satisfies SumCage,
    }
  })

  return (domains) =>
    propagateEach(entries, ({ cells, cage, values, sum }) => {
      if (isAllDecided(domains, cells, values)) {
        return isClueSatisfied(values, cage) ? 'stable' : 'contradiction'
      }
      switch (cage.op) {
        case '+': {
          return propagateSum(domains, sum)
        }
        case '*': {
          return propagateProduct(domains, cells, cage.target)
        }
        case '-':
        case '/':
        case '=': {
          return 'stable'
        }
      }
    })
}
