import { describe, expect, it } from 'vitest'

import { fullFrameQuad, isUsableQuad } from './quad'
import type { Quad } from './quad'

/**
 * Corners from `[x, y]` pairs, clockwise from the top left unless a case says otherwise.
 */
function quadOf(...points: Array<[number, number]>): Quad {
  return points.map(([x, y]) => ({ x, y })) as Quad
}

describe('isUsableQuad', () => {
  it.each([
    ['the whole frame', fullFrameQuad(200, 200)],
    ['a far side shortened by perspective', quadOf([20, 60], [180, 20], [180, 180], [20, 140])],
  ])('takes %s', (_shape, quad) => {
    expect(isUsableQuad(quad, 200, 200)).toBe(true)
  })

  // Each would make the transform singular or fold or mirror the picture.
  it.each([
    ['a corner dragged onto its neighbour', quadOf([10, 10], [190, 10], [190, 10], [10, 190])],
    ['a bow-tie', quadOf([10, 10], [190, 10], [10, 190], [190, 190])],
    ['a mirrored frame', quadOf([200, 0], [0, 0], [0, 200], [200, 200])],
    ['a corner that is not a number', quadOf([10, 10], [NaN, 10], [190, 190], [10, 190])],
  ])('refuses %s', (_shape, quad) => {
    expect(isUsableQuad(quad, 200, 200)).toBe(false)
  })
})
