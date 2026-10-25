import type { PixelImage } from './pixels'
import { quadOutputSize } from './quad'
import type { Point, Quad } from './quad'

/**
 * Projective map from the unit square to a quad: `(u, v)` to
 * `((a u + b v + c) / w, (d u + e v + f) / w)`, where `w = g u + h v + 1`.
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
 * Heckbert's closed form. A crossed or concave quad maps to a folded picture rather than failing,
 * so callers check `isUsableQuad` first; only fully collinear edges throw.
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
  if (determinant === 0) {
    throw new Error('A crop needs four corners that make a convex shape')
  }
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
 * Grows the quad in the rectified plane, so the margin is even once perspective is corrected; the
 * corners may leave the frame. Returns the quad unchanged when a steep tilt would fling a grown
 * corner far out, keeping growth to about twice the margin.
 */
export function marginQuad(quad: Quad, margin: number): Quad {
  const map = squareToQuad(quad)
  // `w` at the quad's own corners, (u, v) = (0, 0), (1, 0), (1, 1) and (0, 1).
  const floor = Math.min(1, 1 + map.g, 1 + map.g + map.h, 1 + map.h) / 2
  if (!(floor > 0)) {
    return quad
  }
  const low = -margin
  const high = 1 + margin
  const corners: Array<[number, number]> = [
    [low, low],
    [high, low],
    [high, high],
    [low, high],
  ]
  const grown: Array<Point> = []
  for (const [u, v] of corners) {
    // `w` is linear, so above the floor at every corner means above it across the quad.
    const w = map.g * u + map.h * v + 1
    if (!(w >= floor)) {
      return quad
    }
    grown.push({ x: (map.a * u + map.b * v + map.c) / w, y: (map.d * u + map.e * v + map.f) / w })
  }
  const [a, b, c, d] = grown
  return a === undefined || b === undefined || c === undefined || d === undefined
    ? quad
    : [a, b, c, d]
}

/**
 * Source pixels per output pixel above which one bilinear sample lets a 1px line vanish or double.
 */
const PREFILTER_ABOVE = 1.3

/**
 * Paper white beyond the frame, where the clamped edge would smear into a band like a border.
 */
const OUTSIDE_FRAME = 255

/**
 * A CPU backstop, or a quad stretched far past the frame hangs the job for minutes. Past it the
 * filter thins out and may miss a line.
 */
const MAX_SAMPLES_PER_AXIS = 8

/**
 * Callers pass the longer side along the axis: the side nearest the camera is shrunk most.
 */
function samplesPerAxis(sourceLength: number, outputLength: number): number {
  const scale = sourceLength / Math.max(1, outputLength)
  return scale > PREFILTER_ABOVE ? Math.min(MAX_SAMPLES_PER_AXIS, Math.ceil(scale)) : 1
}

/**
 * When the crop shrinks the source, each output pixel averages samples over its footprint, so thin
 * grid lines are averaged in rather than aliased away.
 */
export function warpQuadToRect(image: PixelImage, quad: Quad, maxEdge: number): PixelImage {
  const { width, height } = quadOutputSize(quad, maxEdge)
  const map = squareToQuad(quad)
  const source = image.data
  const sourceWidth = image.width
  const maxX = image.width - 1
  const maxY = image.height - 1
  const out = new Uint8ClampedArray(width * height * 4)

  const [p0, p1, p2, p3] = quad
  const samplesX = samplesPerAxis(
    Math.max(Math.hypot(p1.x - p0.x, p1.y - p0.y), Math.hypot(p2.x - p3.x, p2.y - p3.y)),
    width,
  )
  const samplesY = samplesPerAxis(
    Math.max(Math.hypot(p3.x - p0.x, p3.y - p0.y), Math.hypot(p2.x - p1.x, p2.y - p1.y)),
    height,
  )
  const weight = 1 / (samplesX * samplesY)
  const sums = new Float64Array(3)

  function accumulate(u: number, v: number): void {
    const w = map.g * u + map.h * v + 1
    const x = (map.a * u + map.b * v + map.c) / w - 0.5
    const y = (map.d * u + map.e * v + map.f) / w - 0.5
    if (x < -0.5 || y < -0.5 || x > maxX + 0.5 || y > maxY + 0.5) {
      for (let channel = 0; channel < 3; channel++) {
        sums[channel] = (sums[channel] ?? 0) + OUTSIDE_FRAME
      }
      return
    }

    // Within half a pixel of the edge, clamped to the edge pixel rather than reading past it.
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

    for (let channel = 0; channel < 3; channel++) {
      sums[channel] =
        (sums[channel] ?? 0) +
        (source[i00 + channel] ?? 0) * w00 +
        (source[i10 + channel] ?? 0) * w10 +
        (source[i01 + channel] ?? 0) * w01 +
        (source[i11 + channel] ?? 0) * w11
    }
  }

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      sums.fill(0)
      // A lone sample sits at the pixel centre and the quad's corners land on the output's.
      for (let sy = 0; sy < samplesY; sy++) {
        const v = (row + (sy + 0.5) / samplesY) / height
        for (let sx = 0; sx < samplesX; sx++) {
          accumulate((col + (sx + 0.5) / samplesX) / width, v)
        }
      }
      const o = (row * width + col) * 4
      out[o] = (sums[0] ?? 0) * weight
      out[o + 1] = (sums[1] ?? 0) * weight
      out[o + 2] = (sums[2] ?? 0) * weight
      out[o + 3] = 255
    }
  }

  return { width, height, data: out }
}
