import { describe, expect, it } from 'vitest'

import type { PixelImage } from './pixels'
import { isUsableQuad } from './quad'
import type { Quad } from './quad'
import { marginQuad, warpQuadToRect } from './warp'

/**
 * Red is the x coordinate and green the y, so each output pixel says where it came from.
 */
function gradient(width: number, height: number): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < width * height; index++) {
    data[index * 4] = index % width
    data[index * 4 + 1] = Math.floor(index / width)
    data[index * 4 + 3] = 255
  }
  return { width, height, data }
}

function pixelAt(image: PixelImage, x: number, y: number): [number, number] {
  const offset = (y * image.width + x) * 4
  return [image.data[offset]!, image.data[offset + 1]!]
}

const source = gradient(64, 64)

const trapezoid: Quad = [
  { x: 8, y: 8 },
  { x: 56, y: 8 },
  { x: 44, y: 56 },
  { x: 20, y: 56 },
]

describe('warpQuadToRect', () => {
  it('straightens perspective at the corners and inside the crop', () => {
    const out = warpQuadToRect(source, trapezoid, 32)
    expect([out.width, out.height]).toEqual([23, 32])
    // x = (48u + 32v + 8) / (1 + v), y = (104v + 8) / (1 + v), at pixel centres less half a
    // source pixel.
    expect(pixelAt(out, 0, 0)).toEqual([9, 9])
    expect(pixelAt(out, 22, 0)).toEqual([54, 9])
    expect(pixelAt(out, 0, 31)).toEqual([20, 55])
    expect(pixelAt(out, 22, 31)).toEqual([43, 55])
    expect(pixelAt(out, 5, 8)).toEqual([22, 28])
    expect(pixelAt(out, 17, 23)).toEqual([39, 48])
  })
})

describe('marginQuad', () => {
  it('keeps the original quad where it was in the grown one, under perspective', () => {
    const margin = 0.25
    const out = warpQuadToRect(source, marginQuad(trapezoid, margin), 48)
    // The trapezoid's corners sit 0.25 / 1.5 of the way in.
    const at = (u: number, v: number): [number, number] =>
      pixelAt(out, Math.round(u * out.width - 0.5), Math.round(v * out.height - 0.5))
    const inset = margin / (1 + 2 * margin)
    const [topLeftX, topLeftY] = at(inset, inset)
    expect(topLeftX).toBeGreaterThanOrEqual(7)
    expect(topLeftX).toBeLessThanOrEqual(10)
    expect(topLeftY).toBeGreaterThanOrEqual(7)
    expect(topLeftY).toBeLessThanOrEqual(10)
    const [bottomRightX, bottomRightY] = at(1 - inset, 1 - inset)
    expect(bottomRightX).toBeGreaterThanOrEqual(42)
    expect(bottomRightX).toBeLessThanOrEqual(45)
    expect(bottomRightY).toBeGreaterThanOrEqual(54)
    expect(bottomRightY).toBeLessThanOrEqual(57)
  })

  it('leaves the quad alone when growing it would cross the horizon', () => {
    const quad: Quad = [
      { x: 31, y: 8 },
      { x: 33, y: 8 },
      { x: 60, y: 60 },
      { x: 4, y: 60 },
    ]
    expect(marginQuad(quad, 0.2)).toBe(quad)
  })

  it('leaves the quad alone when a grown corner would land far beyond twice the margin', () => {
    // `w` stays positive, but a 4% margin would fling the left corners some 74,000 pixels out.
    const quad: Quad = [
      { x: 200, y: 68 },
      { x: 1800, y: 740.5 },
      { x: 1800, y: 795.5 },
      { x: 200, y: 1468 },
    ]
    expect(isUsableQuad(quad, 2048, 1536)).toBe(true)
    expect(marginQuad(quad, 0.04)).toBe(quad)
  })
})
