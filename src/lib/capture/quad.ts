import {
  downsampleGray,
  labelComponents,
  strokeContrast,
  threshold,
  toGray,
  type Component,
  type LabelledMask,
  type PixelImage,
  type Polarity,
} from './pixels'

export type Point = { x: number; y: number }

/**
Corners in image coordinates, clockwise from the top left.
*/
export type Quad = [Point, Point, Point, Point]

/**
Detection works on a thumbnail: the corners it finds are then scaled back up.
*/
const DETECT_MAX_PIXELS = 400_000

/**
 * Wider than any stroke at thumbnail scale, so a line differs from its own neighbourhood, but not
 * by much: a step edge between two large regions - a phone against a wall - registers for about
 * this far on its ink side, and a wide band there joins things a thin one keeps apart.
 */
const CONTRAST_RADIUS = 4

const CONTRAST_LEVEL = 24

/**
A grid smaller than this share of the frame was not what the picture was of.
*/
const MIN_AREA_FRACTION = 0.08

/**
Bounding-box aspect a grid can reach under the perspective a hand-held shot allows.
*/
const MAX_ASPECT = 1.8

/**
Room around the grid so its outer border is inside the crop rather than on the edge of it.
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

/**
 * A lattice is the densest large thing in a picture of a puzzle: many lines, all connected. Ranked
 * by pixel count squared over bounding-box area, which is size times fill ratio - a phone's edge
 * or a table's outline is large but hollow, a block of text is dense but small.
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

type Candidate = {
  labelled: LabelledMask
  label: number
  score: number
}

/**
 * Both polarities are tried and the better lattice kept: on a whole frame the median luminance
 * says nothing reliable about the puzzle, which may be a dark screen on a light desk.
 */
function findLattice(image: PixelImage): { candidate: Candidate; scale: number } | undefined {
  const gray = downsampleGray(toGray(image), DETECT_MAX_PIXELS)
  const scale = image.width / gray.width
  let best: Candidate | undefined
  for (const polarity of ['dark', 'bright'] satisfies Array<Polarity>) {
    const mask = threshold(strokeContrast(gray, CONTRAST_RADIUS, polarity), CONTRAST_LEVEL)
    const labelled = labelComponents(mask, gray.width, gray.height)
    const picked = pickLattice(labelled.components, gray.width, gray.height)
    if (picked && (!best || picked.score > best.score)) {
      best = { labelled, label: picked.index + 1, score: picked.score }
    }
  }
  return best ? { candidate: best, scale } : undefined
}

/**
 * Where the grid is in the picture, or `undefined` when nothing grid-like was found. Adequate
 * rather than exact: the user gets handles to nudge, so this only has to land close.
 */
export function detectQuad(image: PixelImage): Quad | undefined {
  const found = findLattice(image)
  if (!found) {
    return undefined
  }
  const { labels } = found.candidate.labelled
  const { label } = found.candidate
  const { scale } = found
  const width = Math.round(image.width / scale)
  const height = labels.length / width

  const sides = sideSamples(labels, width, height, label)
  const topLine = fitLine(sides.top, 'x')
  const bottomLine = fitLine(sides.bottom, 'x')
  const leftLine = fitLine(sides.left, 'y')
  const rightLine = fitLine(sides.right, 'y')
  if (!topLine || !bottomLine || !leftLine || !rightLine) {
    return undefined
  }
  const quad: Quad = [
    intersect(topLine, leftLine),
    intersect(topLine, rightLine),
    intersect(bottomLine, rightLine),
    intersect(bottomLine, leftLine),
  ]
  return padQuad(scaleQuad(quad, scale), PAD_FRACTION, image.width, image.height)
}

type Sides = {
  left: Array<Point>
  right: Array<Point>
  top: Array<Point>
  bottom: Array<Point>
}

/**
 * The outermost lattice pixel in each row and column, which is the border wherever the border was
 * picked up, and some interior line wherever it was not.
 */
function sideSamples(labels: Int32Array, width: number, height: number, label: number): Sides {
  const sides: Sides = { left: [], right: [], top: [], bottom: [] }
  const minY = new Int32Array(width).fill(-1)
  const maxY = new Int32Array(width).fill(-1)
  for (let y = 0; y < height; y++) {
    const extent = rowExtent(labels, width, y, label, minY, maxY)
    if (extent) {
      sides.left.push({ x: extent.minX, y })
      sides.right.push({ x: extent.maxX + 1, y })
    }
  }
  for (let x = 0; x < width; x++) {
    if (minY[x]! < 0) {
      continue
    }
    sides.top.push({ x, y: minY[x]! })
    sides.bottom.push({ x, y: maxY[x]! + 1 })
  }
  return sides
}

/**
First and last lattice pixel of one row, updating the per-column extents on the way past.
*/
function rowExtent(
  labels: Int32Array,
  width: number,
  y: number,
  label: number,
  minY: Int32Array,
  maxY: Int32Array,
): { minX: number; maxX: number } | undefined {
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
    if (minY[x]! < 0) {
      minY[x] = y
    }
    maxY[x] = y
  }
  return minX < 0 ? undefined : { minX, maxX }
}

/**
A side of the lattice as `dependent = slope * independent + intercept`.
*/
type Line = {
  independent: 'x' | 'y'
  slope: number
  intercept: number
}

/**
 * Theil-Sen fit: the median of slopes between points half the list apart, then the median
 * intercept. A missing stretch of border - a highlighted cell hides the line beside it - puts
 * interior points among the samples, and a median fit ignores them as long as most of the side
 * was found.
 */
function fitLine(points: Array<Point>, independent: 'x' | 'y'): Line | undefined {
  if (points.length < 8) {
    return undefined
  }
  const dependent = independent === 'x' ? 'y' : 'x'
  const sorted = [...points].sort((a, b) => a[independent] - b[independent])
  const step = Math.floor(sorted.length / 2)
  const slopes: Array<number> = []
  for (let i = 0; i + step < sorted.length; i++) {
    const a = sorted[i]!
    const b = sorted[i + step]!
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
  return { independent, slope, intercept }
}

function median(values: Array<number>): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
Intersection of a side fitted along x with one fitted along y.
*/
function intersect(alongX: Line, alongY: Line): Point {
  // y = a x + b and x = c y + d, so x = c (a x + b) + d.
  const x = (alongY.slope * alongX.intercept + alongY.intercept) / (1 - alongY.slope * alongX.slope)
  return { x, y: alongX.slope * x + alongX.intercept }
}

function scaleQuad(quad: Quad, scale: number): Quad {
  return quad.map((point) => ({ x: point.x * scale, y: point.y * scale })) as Quad
}

/**
Pushes each corner away from the centroid, clamped to the frame.
*/
function padQuad(quad: Quad, fraction: number, width: number, height: number): Quad {
  const centre = {
    x: quad.reduce((sum, point) => sum + point.x, 0) / 4,
    y: quad.reduce((sum, point) => sum + point.y, 0) / 4,
  }
  return quad.map((point) => ({
    x: Math.min(width, Math.max(0, point.x + (point.x - centre.x) * fraction * 2)),
    y: Math.min(height, Math.max(0, point.y + (point.y - centre.y) * fraction * 2)),
  })) as Quad
}

/**
 * Output dimensions that keep the quad's own proportions, long edge at `maxEdge` or at the quad's
 * own size in the source, whichever is smaller. A full-frame quad then downsizes rather than
 * squashing a landscape photo into a square, and a small grid is never upscaled: resampling
 * invents no pixels, and on the bench a blurred clue blown up to twice its size read worse than
 * the same clue at the size the camera saw it.
 */
export function quadOutputSize(
  quad: Quad,
  maxEdge: number,
  options: { allowUpscale?: boolean } = {},
): { width: number; height: number } {
  const [a, b, c, d] = quad
  const top = Math.hypot(b.x - a.x, b.y - a.y)
  const bottom = Math.hypot(c.x - d.x, c.y - d.y)
  const left = Math.hypot(d.x - a.x, d.y - a.y)
  const right = Math.hypot(c.x - b.x, c.y - b.y)
  const aspect = (top + bottom) / Math.max(1, left + right)
  const native = Math.round(Math.max((top + bottom) / 2, (left + right) / 2))
  const edge = options.allowUpscale ? maxEdge : Math.max(1, Math.min(maxEdge, native))
  return aspect >= 1
    ? { width: edge, height: Math.max(1, Math.round(edge / aspect)) }
    : { width: Math.max(1, Math.round(edge * aspect)), height: edge }
}
