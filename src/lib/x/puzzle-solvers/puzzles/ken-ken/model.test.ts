import { describe, expect, it } from 'vitest'

import { createGrid, gridFingerprint } from './model'

describe('gridFingerprint', () => {
  it('tells apart layouts whose cage ids only differ in where two-digit ones fall', () => {
    const first = createGrid(4)
    first.cageOf.set([1, 12])
    const second = createGrid(4)
    second.cageOf.set([11, 2])
    expect(gridFingerprint(first)).not.toBe(gridFingerprint(second))
  })
})
