import { describe, expect, it } from 'vitest'

import { bitOf, fullMask } from '../../csp/bitset'
import { colOf, rowOf } from '../../grid/geometry'
import { cageBounds } from './cage-bounds'
import { isClueSatisfied } from './cage-math'
import type { Cage } from './model'

function valuesOf(mask: number): Array<number> {
  return Array.from({ length: 32 }, (_, bit) => bit + 1).filter(
    (value) => (mask & bitOf(value)) !== 0,
  )
}

/**
 * Runs the propagator for one cage over an 8x8 whose listed cells start from `masks`, every other
 * cell open.
 */
function propagate(cells: Array<number>, cage: Cage, masks: Array<number>) {
  const domains = new Uint32Array(64).fill(fullMask(8))
  for (const [position, cell] of cells.entries()) {
    domains[cell] = masks[position]!
  }
  const result = cageBounds(8, [{ cells: Uint16Array.from(cells), cage }])(domains)
  return { result, values: cells.map((cell) => valuesOf(domains[cell]!)) }
}

// Soundness is the property below; these two show the bounds narrow at all, for a sum and a
// product.
describe('cageBounds', () => {
  it('narrows each cell of a sum to what the others leave room for', () => {
    // Different rows and columns, so the two may repeat: 15 needs 7 or more from each.
    const { result, values } = propagate([0, 9], { op: '+', target: 15 }, [
      fullMask(8),
      fullMask(8),
    ])
    expect(result).toBe('changed')
    expect(values).toEqual([
      [7, 8],
      [7, 8],
    ])
  })

  it('keeps only divisors of what the decided cells leave of a product', () => {
    const { result, values } = propagate([0, 9, 18], { op: '*', target: 42 }, [
      bitOf(6),
      fullMask(8),
      fullMask(8),
    ])
    expect(result).toBe('changed')
    expect(values.slice(1)).toEqual([
      [1, 7],
      [1, 7],
    ])
  })
})

/**
 * A small deterministic generator (mulberry32), so a failing case reproduces.
 */
function seededRandom(seed: number): (below: number) => number {
  let state = seed
  return (below) => {
    state = (state + 0x6d_2b_79_f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)
    return Math.floor((((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32) * below)
  }
}

/**
 * Every assignment of `cells` within `domains` that a solution could hold: cells sharing a row or
 * column differ, and the clue is met.
 */
function validAssignments(
  n: number,
  cells: Array<number>,
  cage: Cage,
  domains: Uint32Array,
): Array<Array<number>> {
  const found: Array<Array<number>> = []
  const values: Array<number> = []
  const place = (position: number): void => {
    if (position === cells.length) {
      if (isClueSatisfied(values, cage)) {
        found.push([...values])
      }
      return
    }
    const cell = cells[position]!
    for (let value = 1; value <= n; value++) {
      if ((domains[cell]! & bitOf(value)) === 0) {
        continue
      }
      const isTakenOnLine = cells
        .slice(0, position)
        .some(
          (other, index) =>
            values[index] === value &&
            (rowOf(n, other) === rowOf(n, cell) || colOf(n, other) === colOf(n, cell)),
        )
      if (isTakenOnLine) {
        continue
      }
      values[position] = value
      place(position + 1)
    }
    values.length = position
  }
  place(0)
  return found
}

describe('cageBounds against brute force', () => {
  it('never refuses or narrows away an assignment that meets the clue', () => {
    const random = seededRandom(20_260_924)
    let satisfiable = 0
    for (let trial = 0; trial < 400; trial++) {
      const n = 4 + random(3)
      const size = 2 + random(4)
      const cells = new Set<number>()
      while (cells.size < size) {
        cells.add(random(n * n))
      }
      const cageCells = [...cells].toSorted((a, b) => a - b)
      const domains = new Uint32Array(n * n).fill(fullMask(n))
      for (const cell of cageCells) {
        // A random non-empty domain, a decided cell now and then.
        domains[cell] = random(4) === 0 ? bitOf(1 + random(n)) : 1 + random(fullMask(n))
      }
      // Targets from a random assignment are usually reachable; the rest test refusals.
      const op = random(2) === 0 ? '+' : '*'
      const sample = cageCells.map(() => 1 + random(n))
      const target =
        op === '+'
          ? sample.reduce((sum, value) => sum + value, 0) + random(3) - 1
          : sample.reduce((product, value) => product * value, 1) * (random(4) === 0 ? 2 : 1)
      const cage: Cage = { op, target }

      const expected = validAssignments(n, cageCells, cage, domains)
      if (expected.length === 0) {
        continue
      }
      satisfiable++
      const narrowed = Uint32Array.from(domains)
      const result = cageBounds(n, [{ cells: Uint16Array.from(cageCells), cage }])(narrowed)
      const context = { n, cageCells, cage, domains: [...domains] }
      expect(result, JSON.stringify(context)).not.toBe('contradiction')
      for (const values of expected) {
        for (const [position, cell] of cageCells.entries()) {
          expect(narrowed[cell]! & bitOf(values[position]!), JSON.stringify(context)).not.toBe(0)
        }
      }
    }
    // Enough of the cases have answers for the check to mean something.
    expect(satisfiable).toBeGreaterThan(100)
  })
})
