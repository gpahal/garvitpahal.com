import { percentile, splitBimodal, type GrayImage } from '@/lib/capture/pixels'

/**
 * Reads the lattice of a rectified square-grid puzzle out of its pixels. Opt-in, like the rest of
 * this directory: a puzzle that is not a grid never imports it.
 *
 * Every function takes a local-contrast image (see `localContrast`), not the photograph, so a
 * bright lattice on a dark screen and dark ink on paper are the same problem.
 */

export type Lattice<TSize extends number = number> = {
  n: TSize
  /**
  Vertical line positions, left to right, `n + 1` of them.
  */
  xs: Array<number>
  /**
  Horizontal line positions, top to bottom, `n + 1` of them.
  */
  ys: Array<number>
}

/**
Contrast below this is texture, not a stroke.
*/
const STROKE_LEVEL = 24

/**
 * A line has to span most of the frame to count as the grid's outer border; interior lines only
 * need to be visible in part, because a cage border is drawn on some cells and not others.
 */
const BORDER_MIN_COVERAGE = 0.5
const INTERIOR_MIN_COVERAGE = 0.08

/**
 * Lines along the other axis cross every position, so the profile never reaches zero. A peak is
 * what rises this far above that floor, which the median of the profile measures.
 */
const PEAK_RISE = 0.06

/**
A peak this strong that no line explains means the candidate size is wrong.
*/
const UNEXPLAINED_MIN_COVERAGE = 0.35

/**
How far, as a fraction of the cell pitch, a line may sit from where a uniform grid predicts it.
*/
const LINE_TOLERANCE = 0.3

/**
A second size scoring within this of the best is an ambiguity, and ambiguity means no answer.
*/
const MIN_SCORE_MARGIN = 0.3

type Peak = {
  position: number
  coverage: number
}

/**
 * Fraction of the cross-axis covered by stroke at each position along `axis`, then the peaks of
 * that profile. A run of consecutive positions above the floor is one peak, placed at its
 * coverage-weighted centre so a thick line reports its middle.
 */
function projectionPeaks(contrast: GrayImage, axis: 'x' | 'y'): Array<Peak> {
  const { width, height, data } = contrast
  const length = axis === 'x' ? width : height
  const span = axis === 'x' ? height : width
  const profile = new Float32Array(length)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x]! > STROKE_LEVEL) {
        profile[axis === 'x' ? x : y]!++
      }
    }
  }
  for (let i = 0; i < length; i++) {
    profile[i] = profile[i]! / span
  }
  const floor = Math.max(INTERIOR_MIN_COVERAGE, median([...profile]) + PEAK_RISE)

  const peaks: Array<Peak> = []
  let start = -1
  let weight = 0
  let moment = 0
  let best = 0
  for (let i = 0; i <= length; i++) {
    const value = i < length ? profile[i]! : 0
    if (value >= floor) {
      if (start < 0) {
        start = i
      }
      weight += value
      moment += value * i
      best = Math.max(best, value)
    } else if (start >= 0) {
      peaks.push({ position: moment / weight + 0.5, coverage: best })
      start = -1
      weight = 0
      moment = 0
      best = 0
    }
  }
  return peaks
}

type Fit<TSize extends number> = {
  n: TSize
  score: number
  lines: Array<number>
}

/**
 * Scores one candidate size against the peaks between two border lines: the share of predicted
 * interior lines that have a peak near them, less the strong peaks left unexplained. Reading a
 * 9x9 as a 3x3 matches every box line but leaves six strong lines unexplained; reading it as an
 * 18x18 explains everything but finds nothing at the half-cell positions.
 */
function fitSize<TSize extends number>(
  peaks: Array<Peak>,
  first: Peak,
  last: Peak,
  n: TSize,
): Fit<TSize> {
  const pitch = (last.position - first.position) / n
  const tolerance = pitch * LINE_TOLERANCE
  const lines: Array<number> = [first.position]
  const explained = new Set<Peak>([first, last])
  let matched = 0

  for (let k = 1; k < n; k++) {
    const expected = first.position + k * pitch
    const nearest = strongestPeakNear(peaks, expected, tolerance)
    if (nearest) {
      matched++
      explained.add(nearest)
      lines.push(nearest.position)
    } else {
      lines.push(expected)
    }
  }
  lines.push(last.position)

  let unexplained = 0
  for (const peak of peaks) {
    if (
      !explained.has(peak) &&
      peak.coverage >= UNEXPLAINED_MIN_COVERAGE &&
      peak.position > first.position &&
      peak.position < last.position
    ) {
      unexplained++
    }
  }

  return { n, score: (matched - unexplained) / (n - 1), lines }
}

/**
The strongest peak within `tolerance` of `position`, if any.
*/
function strongestPeakNear(
  peaks: Array<Peak>,
  position: number,
  tolerance: number,
): Peak | undefined {
  let nearest: Peak | undefined
  for (const peak of peaks) {
    if (
      Math.abs(peak.position - position) <= tolerance &&
      (!nearest || peak.coverage > nearest.coverage)
    ) {
      nearest = peak
    }
  }
  return nearest
}

function bestFit<TSize extends number>(
  peaks: Array<Peak>,
  sizes: ReadonlyArray<TSize>,
): Fit<TSize> | undefined {
  const borders = peaks.filter((peak) => peak.coverage >= BORDER_MIN_COVERAGE)
  if (borders.length < 2) {
    return undefined
  }
  const first = borders[0]!
  const last = borders.at(-1)!

  const fits = sizes.map((n) => fitSize(peaks, first, last, n)).sort((a, b) => b.score - a.score)
  const best = fits[0]
  const runnerUp = fits[1]
  if (
    !best ||
    best.score < 1 ||
    (runnerUp !== undefined && best.score - runnerUp.score < MIN_SCORE_MARGIN)
  ) {
    return undefined
  }
  return best
}

/**
 * The grid's size and line positions, or `undefined` unless both axes agree on a size and no
 * other supported size comes close. A wrong `n` would mislead everything downstream, so this
 * prefers silence to a guess.
 */
export function detectLattice<TSize extends number>(
  contrast: GrayImage,
  sizes: ReadonlyArray<TSize>,
): Lattice<TSize> | undefined {
  const columns = bestFit(projectionPeaks(contrast, 'x'), sizes)
  const rows = bestFit(projectionPeaks(contrast, 'y'), sizes)
  if (columns === undefined || rows === undefined) {
    return undefined
  }
  if (columns.n !== rows.n) {
    return undefined
  }
  return { n: columns.n, xs: columns.lines, ys: rows.lines }
}

function median(values: Array<number>): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * Stroke mass across a segment of a line: at each sample along it, the contrast summed across a
 * window straddling the line, then the median over samples. A heavy line is wider and darker, so
 * its mass is several times a thin one's. The median ignores a clue printed against the line.
 */
function segmentMass(
  contrast: GrayImage,
  axis: 'x' | 'y',
  linePosition: number,
  from: number,
  to: number,
  halfWidth: number,
): number {
  const { width, height, data } = contrast
  const samples: Array<number> = []
  const centre = Math.round(linePosition)
  for (let t = Math.round(from); t <= Math.round(to); t += 2) {
    let sum = 0
    for (let offset = -halfWidth; offset <= halfWidth; offset++) {
      const x = axis === 'x' ? centre + offset : t
      const y = axis === 'x' ? t : centre + offset
      if (x >= 0 && x < width && y >= 0 && y < height) {
        sum += data[y * width + x]!
      }
    }
    samples.push(sum)
  }
  return samples.length === 0 ? 0 : median(samples)
}

function pitchOf(lattice: Lattice): number {
  return (
    (lattice.xs.at(-1)! - lattice.xs[0]! + lattice.ys.at(-1)! - lattice.ys[0]!) / (2 * lattice.n)
  )
}

/**
Window either side of a line: wide enough to hold the heaviest stroke, narrow enough to skip text.
*/
function strokeHalfWidth(lattice: Lattice): number {
  return Math.max(4, Math.round(pitchOf(lattice) * 0.08))
}

/**
The part of each segment sampled: clear of the crossings at its ends and of a clue in its corner.
*/
const SEGMENT_INSET = 0.25

export type LineWeights = {
  /**
  Interior vertical lines, index 1..n-1 of `xs`.
  */
  vertical: Array<number>
  horizontal: Array<number>
}

/**
Mass of every interior line over the full extent of the grid, for telling box lines from cell lines.
*/
export function lineMasses(contrast: GrayImage, lattice: Lattice): LineWeights {
  const halfWidth = strokeHalfWidth(lattice)
  const { n, xs, ys } = lattice
  const vertical: Array<number> = []
  const horizontal: Array<number> = []
  for (let k = 1; k < n; k++) {
    vertical.push(segmentMass(contrast, 'x', xs[k]!, ys[0]!, ys[n]!, halfWidth))
    horizontal.push(segmentMass(contrast, 'y', ys[k]!, xs[0]!, xs[n]!, halfWidth))
  }
  return { vertical, horizontal }
}

/**
An interior edge, named by the cell on its top or left.
*/
export type GridEdge = {
  /**
  Row-major index.
  */
  cell: number
  side: 'right' | 'bottom'
}

export type EdgeMass = GridEdge & {
  mass: number
}

/**
Mass of every one of the `2n(n-1)` interior edges, one cell long each.
*/
export function edgeMasses(contrast: GrayImage, lattice: Lattice): Array<EdgeMass> {
  const halfWidth = strokeHalfWidth(lattice)
  const { n, xs, ys } = lattice
  const edges: Array<EdgeMass> = []
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const cell = row * n + col
      const cellHeight = ys[row + 1]! - ys[row]!
      const cellWidth = xs[col + 1]! - xs[col]!
      if (col < n - 1) {
        edges.push({
          cell,
          side: 'right',
          mass: segmentMass(
            contrast,
            'x',
            xs[col + 1]!,
            ys[row]! + cellHeight * SEGMENT_INSET,
            ys[row + 1]! - cellHeight * SEGMENT_INSET,
            halfWidth,
          ),
        })
      }
      if (row < n - 1) {
        edges.push({
          cell,
          side: 'bottom',
          mass: segmentMass(
            contrast,
            'y',
            ys[row + 1]!,
            xs[col]! + cellWidth * SEGMENT_INSET,
            xs[col + 1]! - cellWidth * SEGMENT_INSET,
            halfWidth,
          ),
        })
      }
    }
  }
  return edges
}

/**
Cells are sampled inside this inset so the lines around them do not count as ink.
*/
const CELL_INSET = 0.12

/**
Deeper inset for reading a cell's fill colour, clear of the stroke contrast around its lines.
*/
const SHADE_INSET = 0.3

/**
 * A cell whose fill differs from the others' by this much is highlighted. The apps these puzzles
 * are photographed from mark the selected cell that way, and a fill next to a line changes the
 * line's measured weight, so its edges have to be left out.
 */
const SHADE_LEVEL = 40

/**
Fraction of each cell's interior that is stroke, row-major.
*/
export function cellInk(contrast: GrayImage, lattice: Lattice): Array<number> {
  const { n, xs, ys } = lattice
  const { width, data } = contrast
  const ink: Array<number> = []
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const cellWidth = xs[col + 1]! - xs[col]!
      const cellHeight = ys[row + 1]! - ys[row]!
      const x0 = Math.round(xs[col]! + cellWidth * CELL_INSET)
      const x1 = Math.round(xs[col + 1]! - cellWidth * CELL_INSET)
      const y0 = Math.round(ys[row]! + cellHeight * CELL_INSET)
      const y1 = Math.round(ys[row + 1]! - cellHeight * CELL_INSET)
      let stroke = 0
      let total = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          total++
          if (data[y * width + x]! > STROKE_LEVEL) {
            stroke++
          }
        }
      }
      ink.push(total === 0 ? 0 : stroke / total)
    }
  }
  return ink
}

/**
 * Row-major indices of cells filled with a colour unlike the rest of the grid. Read off the
 * picture itself rather than the contrast, which is blind to a flat fill.
 */
export function shadedCells(gray: GrayImage, lattice: Lattice): Array<number> {
  const { n, xs, ys } = lattice
  const { width, data } = gray
  const levels: Array<number> = []
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const cellWidth = xs[col + 1]! - xs[col]!
      const cellHeight = ys[row + 1]! - ys[row]!
      const x0 = Math.round(xs[col]! + cellWidth * SHADE_INSET)
      const x1 = Math.round(xs[col + 1]! - cellWidth * SHADE_INSET)
      const y0 = Math.round(ys[row]! + cellHeight * SHADE_INSET)
      const y1 = Math.round(ys[row + 1]! - cellHeight * SHADE_INSET)
      const samples: Array<number> = []
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          samples.push(data[y * width + x]!)
        }
      }
      levels.push(samples.length === 0 ? 0 : median(samples))
    }
  }
  const typical = percentile(Uint8ClampedArray.from(levels), 0.5)
  const shaded: Array<number> = []
  for (const [cell, level] of levels.entries()) {
    if (Math.abs(level - typical) > SHADE_LEVEL) {
      shaded.push(cell)
    }
  }
  return shaded
}

/**
 * Splits a set of masses into light and heavy, or `undefined` when they do not fall into two
 * clear groups. `minSeparation` is the gap between groups as a fraction of the range; the truth
 * script on the bench images found real lattices perfectly bimodal, so anything muddier is a
 * picture this cannot read and should say nothing about.
 */
export function splitHeavy(
  masses: Array<number>,
  minSeparation: number,
): { isHeavy: (mass: number) => boolean } | undefined {
  const split = splitBimodal(masses)
  if (split.high.length === 0 || split.separation < minSeparation) {
    return undefined
  }
  return { isHeavy: (mass) => mass > split.threshold }
}
