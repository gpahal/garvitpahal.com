import type { PixelImage } from './pixels'
import { quadOutputSize, type Quad } from './quad'

/**
Projective map from the unit square to a quad: `(u, v)` to `((a u + b v + c) / w, (d u + e v + f) / w)`.
*/
type Homography = {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
  g: number
  h: number
}

/**
 * Heckbert's closed form for the square-to-quadrilateral homography. Solving the general 8x8
 * system would give the same matrix; this needs no linear algebra and never hits a singular
 * pivot for a convex quad.
 */
function squareToQuad(quad: Quad): Homography {
  const [p0, p1, p2, p3] = quad
  const sx = p0.x - p1.x + p2.x - p3.x
  const sy = p0.y - p1.y + p2.y - p3.y

  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    return {
      a: p1.x - p0.x,
      b: p2.x - p1.x,
      c: p0.x,
      d: p1.y - p0.y,
      e: p2.y - p1.y,
      f: p0.y,
      g: 0,
      h: 0,
    }
  }

  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const determinant = dx1 * dy2 - dx2 * dy1
  const g = (sx * dy2 - dx2 * sy) / determinant
  const h = (dx1 * sy - sx * dy1) / determinant
  return {
    a: p1.x - p0.x + g * p1.x,
    b: p3.x - p0.x + h * p3.x,
    c: p0.x,
    d: p1.y - p0.y + g * p1.y,
    e: p3.y - p0.y + h * p3.y,
    f: p0.y,
    g,
    h,
  }
}

/**
 * Resamples the quad into an upright rectangle, long edge `maxEdge`. Inverse mapping with bilinear
 * sampling: every output pixel looks up where it came from, so there are no holes and no seams.
 * Samples outside the source clamp to its edge rather than reading garbage.
 */
export function warpQuadToRect(
  image: PixelImage,
  quad: Quad,
  maxEdge: number,
  options: { allowUpscale?: boolean } = {},
): PixelImage {
  const { width, height } = quadOutputSize(quad, maxEdge, options)
  const map = squareToQuad(quad)
  const source = image.data
  const sourceWidth = image.width
  const maxX = image.width - 1
  const maxY = image.height - 1
  const out = new Uint8ClampedArray(width * height * 4)

  for (let row = 0; row < height; row++) {
    // Pixel centres, so the corners of the quad land on the corners of the output.
    const v = (row + 0.5) / height
    for (let col = 0; col < width; col++) {
      const u = (col + 0.5) / width
      const w = map.g * u + map.h * v + 1
      const x = (map.a * u + map.b * v + map.c) / w - 0.5
      const y = (map.d * u + map.e * v + map.f) / w - 0.5

      const x0 = Math.min(maxX, Math.max(0, Math.floor(x)))
      const y0 = Math.min(maxY, Math.max(0, Math.floor(y)))
      const x1 = Math.min(maxX, x0 + 1)
      const y1 = Math.min(maxY, y0 + 1)
      const fx = Math.min(1, Math.max(0, x - x0))
      const fy = Math.min(1, Math.max(0, y - y0))

      const i00 = (y0 * sourceWidth + x0) * 4
      const i10 = (y0 * sourceWidth + x1) * 4
      const i01 = (y1 * sourceWidth + x0) * 4
      const i11 = (y1 * sourceWidth + x1) * 4
      const w00 = (1 - fx) * (1 - fy)
      const w10 = fx * (1 - fy)
      const w01 = (1 - fx) * fy
      const w11 = fx * fy

      const o = (row * width + col) * 4
      for (let channel = 0; channel < 3; channel++) {
        out[o + channel] =
          source[i00 + channel]! * w00 +
          source[i10 + channel]! * w10 +
          source[i01 + channel]! * w01 +
          source[i11 + channel]! * w11
      }
      out[o + 3] = 255
    }
  }

  return { width, height, data: out }
}
