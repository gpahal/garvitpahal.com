import { describe, expect, it, test } from 'vitest'

import { NEVER, STOPPED } from '../../csp/test-deadline'
import { cageTuples, isClueSatisfied } from './cage-math'
import type { CageOp } from './model'

describe('isClueSatisfied', () => {
  it('checks each operator without regard to order, and only whole quotients', () => {
    expect(isClueSatisfied([1, 2, 3], { op: '+', target: 6 })).toBe(true)
    expect(isClueSatisfied([1, 2, 3], { op: '+', target: 7 })).toBe(false)
    expect(isClueSatisfied([2, 3], { op: '*', target: 6 })).toBe(true)
    expect(isClueSatisfied([1, 4], { op: '-', target: 3 })).toBe(true)
    expect(isClueSatisfied([4, 1], { op: '-', target: 3 })).toBe(true)
    expect(isClueSatisfied([2, 4], { op: '/', target: 2 })).toBe(true)
    expect(isClueSatisfied([4, 2], { op: '/', target: 2 })).toBe(true)
    expect(isClueSatisfied([3], { op: '=', target: 3 })).toBe(true)
    expect(isClueSatisfied([3, 2], { op: '/', target: 1 })).toBe(false)
  })
})

const tuples = (
  n: number,
  cells: Array<number>,
  op: CageOp,
  target: number,
): Array<Array<number>> | undefined =>
  cageTuples(n, Uint16Array.from(cells), { op, target }, NEVER, STOPPED)?.map((tuple) => [...tuple])

describe('cageTuples', () => {
  it('lists every assignment, aligned with the cells, that satisfies the clue', () => {
    // Two cells in one row: the values must differ.
    expect(tuples(4, [0, 1], '+', 5)).toEqual([
      [1, 4],
      [2, 3],
      [3, 2],
      [4, 1],
    ])
  })

  it('lets two cells repeat a value when they share neither row nor column', () => {
    // An L of three: cells 0 and 5 are diagonal, so 2 + 2 + 1 counts.
    expect(tuples(4, [0, 1, 5], '+', 5)).toContainEqual([2, 1, 2])
    expect(tuples(4, [0, 1, 5], '+', 5)).not.toContainEqual([2, 2, 1])
  })

  it('prunes a sum or product that can no longer reach its target', () => {
    expect(tuples(4, [0, 4, 8], '+', 3)).toEqual([])
    expect(tuples(4, [0, 4], '*', 7)).toEqual([])
    expect(tuples(4, [0, 4], '*', 12)).toEqual([
      [3, 4],
      [4, 3],
    ])
  })

  it('answers a clue on the wrong number of cells with no tuples at all', () => {
    expect(tuples(4, [0, 1, 2], '-', 1)).toEqual([])
    expect(tuples(4, [0, 1], '=', 1)).toEqual([])
  })
})

test('checks the injected deadline before and after cage enumeration', () => {
  // With no deadline the enumeration finds every Latin square of order 4, which no pruning of an
  // impossible-to-narrow sum can shorten.
  const cells = Uint16Array.from({ length: 16 }, (_, index) => index)
  expect(cageTuples(4, cells, { op: '+', target: 40 }, NEVER, STOPPED)).toHaveLength(576)
  expect(cageTuples(4, cells, { op: '+', target: 40 }, 0, () => 0)).toBeUndefined()
  let now = 0
  expect(cageTuples(4, cells, { op: '+', target: 40 }, 1, () => now++)).toBeUndefined()
  expect(now).toBe(2)
})
