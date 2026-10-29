import { describe, expect, it } from 'vitest'

import { boxGroups } from './geometry'

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
