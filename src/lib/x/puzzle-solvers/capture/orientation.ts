import type { PixelImage } from './pixels'
import { mapQuad } from './quad'
import type { Point, Quad } from './quad'

/**
 * Clockwise quarter turns, then a left-right mirror of the turned picture.
 */
export type Orientation = { quarterTurns: 0 | 1 | 2 | 3; mirrored: boolean }

export const UPRIGHT: Orientation = { quarterTurns: 0, mirrored: false }

export const TURN_RIGHT: Orientation = { quarterTurns: 1, mirrored: false }
export const TURN_LEFT: Orientation = { quarterTurns: 3, mirrored: false }
export const FLIP: Orientation = { quarterTurns: 0, mirrored: true }

/**
 * `second` applies to the picture `first` gives, so after a mirror its turns count anticlockwise.
 */
export function combine(first: Orientation, second: Orientation): Orientation {
  const turns = first.mirrored ? -second.quarterTurns : second.quarterTurns
  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- a non-negative sum mod 4
    quarterTurns: ((first.quarterTurns + turns + 4) % 4) as Orientation['quarterTurns'],
    mirrored: first.mirrored !== second.mirrored,
  }
}

/**
 * In the continuous coordinates quads use, where the picture spans `0..width`.
 */
function orientPoint(
  { x, y }: Point,
  { quarterTurns, mirrored }: Orientation,
  width: number,
  height: number,
): Point {
  const turns: [Point, Point, Point, Point] = [
    { x, y },
    { x: height - y, y: x },
    { x: width - x, y: height - y },
    { x: y, y: width - x },
  ]
  const turned = turns[quarterTurns]
  const turnedWidth = quarterTurns % 2 === 1 ? height : width
  return mirrored ? { x: turnedWidth - turned.x, y: turned.y } : turned
}

/**
 * Reorders the corners to stay clockwise from the top left, so the rectified grid turns and mirrors
 * with the picture.
 */
export function orientQuad(
  quad: Quad,
  orientation: Orientation,
  size: { width: number; height: number },
): Quad {
  const orient = (point: Point): Point => orientPoint(point, orientation, size.width, size.height)
  const [a, b, c, d] = mapQuad(quad, orient)
  // A clockwise turn moves each corner one place on; a mirror swaps left and right corners.
  const turns: [Quad, Quad, Quad, Quad] = [
    [a, b, c, d],
    [d, a, b, c],
    [c, d, a, b],
    [b, c, d, a],
  ]
  const [topLeft, topRight, bottomRight, bottomLeft] = turns[orientation.quarterTurns]
  return orientation.mirrored
    ? [topRight, topLeft, bottomLeft, bottomRight]
    : [topLeft, topRight, bottomRight, bottomLeft]
}

/**
 * Applied to the pixels rather than as a CSS transform, so the grid and handles sit on the picture
 * the user sees. Returns the source itself when upright.
 */
export function orientImage(image: PixelImage, orientation: Orientation): PixelImage {
  type Affine = [number, number, number, number, number, number]
  const { quarterTurns, mirrored } = orientation
  if (quarterTurns === 0 && !mirrored) {
    return image
  }
  const { width, height, data } = image
  const isSideways = quarterTurns % 2 === 1
  const outWidth = isSideways ? height : width
  const outHeight = isSideways ? width : height
  // Source of a turned, not yet mirrored, pixel: x = ax * x + bx * y + cx, and likewise for y.
  const turns: [Affine, Affine, Affine, Affine] = [
    [1, 0, 0, 0, 1, 0],
    [0, 1, 0, -1, 0, height - 1],
    [-1, 0, width - 1, 0, -1, height - 1],
    [0, -1, width - 1, 1, 0, 0],
  ]
  const [ax, bx, cx, ay, by, cy] = turns[quarterTurns]
  const source = new Uint32Array(data.buffer, data.byteOffset, width * height)
  const out = new Uint32Array(outWidth * outHeight)
  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      const turnedX = mirrored ? outWidth - 1 - x : x
      const sourceX = ax * turnedX + bx * y + cx
      const sourceY = ay * turnedX + by * y + cy
      out[y * outWidth + x] = source[sourceY * width + sourceX] ?? 0
    }
  }
  return {
    width: outWidth,
    height: outHeight,
    data: new Uint8ClampedArray(out.buffer, out.byteOffset, out.byteLength),
  }
}
