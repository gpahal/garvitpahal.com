import { describe, expect, it } from 'vitest'

import { bitOf } from './bitset'
import { table } from './table'

function maskOf(...values: Array<number>): number {
  return values.reduce((mask, value) => (mask | bitOf(value)) >>> 0, 0)
}

describe('table', () => {
  it('keeps only the values some still-possible tuple uses', () => {
    const propagate = table([
      {
        variables: new Uint16Array([0, 1]),
        tuples: [new Uint8Array([1, 2]), new Uint8Array([2, 3]), new Uint8Array([3, 1])],
      },
    ])
    const domains = new Uint32Array([maskOf(1, 2, 3), maskOf(2, 3)])
    expect(propagate(domains)).toBe('changed')
    expect([...domains]).toEqual([maskOf(1, 2), maskOf(2, 3)])
    expect(propagate(domains)).toBe('stable')
  })

  it('answers from each constraint as its scope stands, across the branches of a search', () => {
    const propagate = table([
      { variables: new Uint16Array([0]), tuples: [new Uint8Array([1]), new Uint8Array([2])] },
      {
        variables: new Uint16Array([1]),
        tuples: [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])],
      },
    ])
    const domains = new Uint32Array([maskOf(1, 2), maskOf(1, 2, 3)])
    expect(propagate(domains)).toBe('stable')

    // A fresh copy, as the search makes per branch.
    const branch = Uint32Array.from(domains)
    branch[1] = maskOf(2)
    expect(propagate(branch)).toBe('stable')
    expect(propagate(branch)).toBe('stable')

    branch[0] = maskOf(3)
    expect(propagate(branch)).toBe('contradiction')
    expect(propagate(Uint32Array.from(domains))).toBe('stable')
  })
})
