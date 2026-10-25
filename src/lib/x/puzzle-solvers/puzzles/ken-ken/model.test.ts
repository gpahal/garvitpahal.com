import { describe, expect, it } from 'vitest'

import { createGrid, gridFingerprint, isBlankGrid } from './model'

describe('gridFingerprint', () => {
  it('tells apart layouts whose cage ids only differ in where two-digit ones fall', () => {
    const first = createGrid(4)
    first.cageOf.set([1, 12])
    const second = createGrid(4)
    second.cageOf.set([11, 2])
    expect(gridFingerprint(first)).not.toBe(gridFingerprint(second))
  })
})

describe('isBlankGrid', () => {
  it('finds nothing to lose in a new grid, and counts a clue or a cage joining cells as work', () => {
    expect(isBlankGrid(createGrid(4))).toBe(true)
    const clued = createGrid(4)
    clued.cages[0] = { op: '=', target: 3 }
    expect(isBlankGrid(clued)).toBe(false)
    const joined = createGrid(4)
    joined.cageOf[1] = 0
    joined.cages.pop()
    expect(isBlankGrid(joined)).toBe(false)
  })
})
