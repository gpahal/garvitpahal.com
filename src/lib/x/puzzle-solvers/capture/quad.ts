import {
  downsampleGray,
  labelComponents,
  median,
  STROKE_LEVEL,
  strokeContrast,
  threshold,
  toGray,
} from './pixels'
import type { Component, PixelImage, Polarity } from './pixels'

export type Point = { x: number; y: number }

/**
 * Corners in image coordinates, clockwise from the top left.
 */
export type Quad = [Point, Point, Point, Point]

const DETECT_MAX_PIXELS = 400_000

/**
 * Wider than any thumbnail stroke, but barely: a step edge (a phone against a wall) registers about
 * this far on its ink side, and a wider band joins things a thin one keeps apart.
 */
const CONTRAST_RADIUS = 4

const MIN_AREA_FRACTION = 0.08

/**
 * Bounding-box aspect a grid can reach under the perspective a hand-held shot allows.
 */
const MAX_ASPECT = 1.8

/**
 * Keeps the grid's outer border inside the crop rather than on its edge.
 */
const PAD_FRACTION = 0.02

export function fullFrameQuad(width: number, height: number): Quad {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
}

export function mapQuad(quad: Quad, transform: (point: Point) => Point): Quad {
  return [transform(quad[0]), transform(quad[1]), transform(quad[2]), transform(quad[3])]
}

export function isSameQuad(a: Quad, b: Quad): boolean {
  return a.every((point, index) => {
    const other = b[index]
    return point.x === other?.x && point.y === other.y
  })
}

/**
 * Ranks by size times fill ratio: the lattice is large and dense, where a phone's edge is large
 * but hollow and a block of text dense but small.
 */
function pickLattice(
  components: Array<Component>,
  width: number,
  height: number,
): { index: number; score: number } | undefined {
  let best: { index: number; score: number } | undefined
  for (const [index, component] of components.entries()) {
    const boxWidth = component.maxX - component.minX + 1
    const boxHeight = component.maxY - component.minY + 1
    const boxArea = boxWidth * boxHeight
    const aspect = boxWidth / boxHeight
    if (
      boxArea < MIN_AREA_FRACTION * width * height ||
      aspect > MAX_ASPECT ||
      aspect < 1 / MAX_ASPECT
    ) {
      continue
    }
    const score = (component.size * component.size) / boxArea
    if (!best || score > best.score) {
      best = { index, score }
    }
  }
  return best
}

/**
 * Tries both polarities: a whole frame's median luminance says nothing about the puzzle, which may
 * be a dark screen on a light desk.
 */
function findLattice(
  image: PixelImage,
): { labels: Int32Array; label: number; width: number; height: number; scale: number } | undefined {
  const gray = downsampleGray(toGray(image), DETECT_MAX_PIXELS)
  let best: { labels: Int32Array; label: number; score: number } | undefined
  for (const polarity of ['dark', 'bright'] satisfies Array<Polarity>) {
    const mask = threshold(strokeContrast(gray, CONTRAST_RADIUS, polarity), STROKE_LEVEL)
    const { labels, components } = labelComponents(mask, gray.width, gray.height)
    const picked = pickLattice(components, gray.width, gray.height)
    if (picked && (!best || picked.score > best.score)) {
      best = { labels, label: picked.index + 1, score: picked.score }
    }
  }
  return best
    ? {
        labels: best.labels,
        label: best.label,
        width: gray.width,
        height: gray.height,
        scale: gray.factor,
      }
    : undefined
}

/**
 * Lands close rather than exact, since the user nudges the handles, and a little outside the grid
 * rather than on it.
 */
export function detectQuad(image: PixelImage): Quad | undefined {
  const found = findLattice(image)
  if (!found) {
    return undefined
  }
  const { labels, label, width, height, scale } = found

  const sides = sideSamples(labels, width, height, label)
  const topLine = fitLine(sides.top, 'x')
  const bottomLine = fitLine(sides.bottom, 'x')
  const leftLine = fitLine(sides.left, 'y')
  const rightLine = fitLine(sides.right, 'y')
  return topLine && bottomLine && leftLine && rightLine
    ? cornersOf(
        { top: topLine, bottom: bottomLine, left: leftLine, right: rightLine },
        scale,
        image.width,
        image.height,
      )
    : undefined
}

/**
 * `undefined` when the sides make no usable crop: nearly parallel sides clamp to collapsed or
 * crossed corners, and review would blame corners the user never dragged.
 */
function cornersOf(
  sides: { top: Line; bottom: Line; left: Line; right: Line },
  scale: number,
  width: number,
  height: number,
): Quad | undefined {
  const { top, bottom, left, right } = sides
  const quad: Quad = [
    intersect(top, left),
    intersect(top, right),
    intersect(bottom, right),
    intersect(bottom, left),
  ]
  const padded = padQuad(scaleQuad(quad, scale), PAD_FRACTION, width, height)
  return isUsableQuad(padded, width, height) ? padded : undefined
}

type Sides = {
  left: Array<Point>
  right: Array<Point>
  top: Array<Point>
  bottom: Array<Point>
}

/**
 * The outermost lattice pixel in each row and column: the border where it was picked up, some
 * interior line where not.
 */
function sideSamples(labels: Int32Array, width: number, height: number, label: number): Sides {
  const sides: Sides = { left: [], right: [], top: [], bottom: [] }
  const minY = new Int32Array(width).fill(-1)
  const maxY = new Int32Array(width).fill(-1)
  for (let y = 0; y < height; y++) {
    let minX = -1
    let maxX = -1
    for (let x = 0; x < width; x++) {
      if (labels[y * width + x] !== label) {
        continue
      }
      if (minX < 0) {
        minX = x
      }
      maxX = x
      if ((minY[x] ?? 0) < 0) {
        minY[x] = y
      }
      maxY[x] = y
    }
    if (minX < 0) {
      continue
    }

    sides.left.push({ x: minX, y })
    sides.right.push({ x: maxX + 1, y })
  }
  for (let x = 0; x < width; x++) {
    if ((minY[x] ?? 0) < 0) {
      continue
    }
    sides.top.push({ x, y: minY[x] ?? 0 })
    sides.bottom.push({ x, y: (maxY[x] ?? 0) + 1 })
  }
  return sides
}

/**
 * A side of the lattice as `dependent = slope * independent + intercept`: `y` in terms of `x` for
 * the top and bottom, `x` in terms of `y` for the left and right.
 */
type Line = {
  slope: number
  intercept: number
}

/**
 * Theil-Sen, so interior points where a stretch of border is missing (a highlighted cell hides it)
 * are ignored while most of the side was found.
 */
function fitLine(points: Array<Point>, independent: 'x' | 'y'): Line | undefined {
  if (points.length < 8) {
    return undefined
  }
  const dependent = independent === 'x' ? 'y' : 'x'
  const sorted = points.toSorted((a, b) => a[independent] - b[independent])
  const step = Math.floor(sorted.length / 2)
  const slopes: Array<number> = []
  for (const [i, a] of sorted.entries()) {
    const b = sorted[i + step]
    if (b === undefined) {
      break
    }
    const run = b[independent] - a[independent]
    if (run > 0) {
      slopes.push((b[dependent] - a[dependent]) / run)
    }
  }
  if (slopes.length === 0) {
    return undefined
  }
  const slope = median(slopes)
  const intercept = median(sorted.map((point) => point[dependent] - slope * point[independent]))
  return { slope, intercept }
}

function intersect(alongX: Line, alongY: Line): Point {
  // y = a x + b and x = c y + d, so x = c (a x + b) + d.
  const x = (alongY.slope * alongX.intercept + alongY.intercept) / (1 - alongY.slope * alongX.slope)
  return { x, y: alongX.slope * x + alongX.intercept }
}

function scaleQuad(quad: Quad, scale: number): Quad {
  return mapQuad(quad, (point) => ({ x: point.x * scale, y: point.y * scale }))
}

function padQuad(quad: Quad, fraction: number, width: number, height: number): Quad {
  const centre = {
    x: quad.reduce((sum, point) => sum + point.x, 0) / 4,
    y: quad.reduce((sum, point) => sum + point.y, 0) / 4,
  }
  return mapQuad(quad, (point) => ({
    x: Math.min(width, Math.max(0, point.x + (point.x - centre.x) * fraction * 2)),
    y: Math.min(height, Math.max(0, point.y + (point.y - centre.y) * fraction * 2)),
  }))
}

/**
 * Of the frame's shorter edge. Perspective shortens a side by well under this, so a shorter side is
 * a corner dragged onto another.
 */
const MIN_SIDE_FRACTION = 0.03

/**
 * Requires a convex, clockwise quad with usable edges: crossed or collapsed handles can make the
 * homography singular, short edges magnify noise, and anticlockwise corners warp to a mirrored
 * picture that would be sent and misread.
 */
export function isUsableQuad(quad: Quad, width: number, height: number): boolean {
  if (quad.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return false
  }
  const minSide = MIN_SIDE_FRACTION * Math.min(width, height)
  const epsilon = width * height * 1e-6
  const [a, b, c, d] = quad
  const turns: Array<[Point, Point, Point]> = [
    [a, b, c],
    [b, c, d],
    [c, d, a],
    [d, a, b],
  ]
  for (const [point, next, after] of turns) {
    if (Math.hypot(next.x - point.x, next.y - point.y) < minSide) {
      return false
    }
    const cross = (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x)
    if (cross <= epsilon) {
      return false
    }
  }
  return true
}

/**
 * Keeps the quad's proportions, long edge capped at `maxEdge`. Never upscales: a blurred clue blown
 * up to twice its size read worse than at the size the camera saw it.
 */
export function quadOutputSize(quad: Quad, maxEdge: number): { width: number; height: number } {
  const [a, b, c, d] = quad
  const top = Math.hypot(b.x - a.x, b.y - a.y)
  const bottom = Math.hypot(c.x - d.x, c.y - d.y)
  const left = Math.hypot(d.x - a.x, d.y - a.y)
  const right = Math.hypot(c.x - b.x, c.y - b.y)
  const aspect = (top + bottom) / Math.max(1, left + right)
  const native = Math.round(Math.max((top + bottom) / 2, (left + right) / 2))
  const edge = Math.max(1, Math.min(maxEdge, native))
  return aspect >= 1
    ? { width: edge, height: Math.max(1, Math.round(edge / aspect)) }
    : { width: Math.max(1, Math.round(edge * aspect)), height: edge }
}

/**
 * About 20 pixels a cell on a 9x9. Warned about rather than refused, since a sharp small grid can
 * still read.
 */
const MIN_CROP_SIDE = 180

/**
 * Measured as the crop is built, so it counts the pixels the model will see.
 */
export function isSmallCrop(quad: Quad): boolean {
  const { width, height } = quadOutputSize(quad, Infinity)
  return Math.min(width, height) < MIN_CROP_SIDE
}

/**
 * A press grabs this corner rather than the handle hit, since on a small crop the hit areas overlap
 * and the last drawn would cover the others.
 */
export function nearestCorner(quad: Quad, point: Point): number {
  let nearest = 0
  let nearestDistance = Infinity
  for (const [index, corner] of quad.entries()) {
    const distance = Math.hypot(corner.x - point.x, corner.y - point.y)
    if (distance >= nearestDistance) {
      continue
    }
    nearest = index
    nearestDistance = distance
  }
  return nearest
}
