import { describe, expect, it } from 'vitest'

import { boxGroups, gridSizes } from './geometry'

describe('boxGroups', () => {
  it('numbers wide boxes left to right, then top to bottom, each in reading order', () => {
    expect(boxGroups(6, 3, 2).map((box) => [...box])).toEqual([
      [0, 1, 2, 6, 7, 8],
      [3, 4, 5, 9, 10, 11],
      [12, 13, 14, 18, 19, 20],
      [15, 16, 17, 21, 22, 23],
      [24, 25, 26, 30, 31, 32],
      [27, 28, 29, 33, 34, 35],
    ])
  })
})

describe('gridSizes', () => {
  it('names every size, and the span from the first to the largest', () => {
    const sizes = gridSizes([4, 6, 9])
    expect(sizes.listed).toBe('4×4, 6×6 and 9×9')
    expect(sizes.range).toBe('4×4 to 9×9')
  })
})
