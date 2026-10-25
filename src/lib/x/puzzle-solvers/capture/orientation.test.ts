import { describe, expect, it } from 'vitest'

import { combine, FLIP, orientImage, orientQuad, TURN_LEFT, TURN_RIGHT } from './orientation'
import type { Orientation } from './orientation'
import type { PixelImage } from './pixels'
import { fullFrameQuad, isUsableQuad } from './quad'
import type { Quad } from './quad'

/**
 * A 3x2 picture whose pixels are 1..6 row-major in the red channel, so every orientation differs.
 */
function source(): PixelImage {
  const data = new Uint8ClampedArray(6 * 4)
  for (let i = 0; i < 6; i++) data[i * 4] = i + 1
  return { width: 3, height: 2, data }
}

function reds({ width, height, data }: PixelImage) {
  return { width, height, reds: Array.from({ length: width * height }, (_, i) => data[i * 4]) }
}

const ORIENTATIONS: Array<Orientation> = [0, 1, 2, 3].flatMap((quarterTurns) =>
  [false, true].map((mirrored) => ({ quarterTurns: quarterTurns as 0 | 1 | 2 | 3, mirrored })),
)

const size = { width: 3, height: 2 }

/**
 * Corners on the pixel centres of `source()` holding 1, 3, 6 and 4.
 */
const corners: Quad = [
  { x: 0.5, y: 0.5 },
  { x: 2.5, y: 0.5 },
  { x: 2.5, y: 1.5 },
  { x: 0.5, y: 1.5 },
]

describe('orientImage', () => {
  it('gives each of the eight orientations a different picture', () => {
    const pictures = ORIENTATIONS.map((each) => JSON.stringify(reds(orientImage(source(), each))))
    expect(new Set(pictures).size).toBe(8)
  })

  it.each(ORIENTATIONS)('moves corners with their pixels and composes under %o', (orientation) => {
    const picture = orientImage(source(), orientation)
    const shownSize = orientQuad(fullFrameQuad(3, 2), orientation, size)[2]
    const shown = orientQuad(corners, orientation, size)
    const marked = shown.map(
      ({ x, y }) => picture.data[(Math.floor(y) * picture.width + Math.floor(x)) * 4],
    )
    expect(marked.toSorted((a, b) => a! - b!)).toEqual([1, 3, 4, 6])
    expect(shownSize).toEqual({ x: picture.width, y: picture.height })
    expect(isUsableQuad(shown, picture.width, picture.height)).toBe(true)

    for (const change of [TURN_RIGHT, TURN_LEFT, FLIP]) {
      const label = JSON.stringify(change)
      expect(reds(orientImage(source(), combine(orientation, change))), label).toEqual(
        reds(orientImage(picture, change)),
      )
      expect(orientQuad(shown, change, { width: shownSize.x, height: shownSize.y }), label).toEqual(
        orientQuad(corners, combine(orientation, change), size),
      )
    }
  })
})
