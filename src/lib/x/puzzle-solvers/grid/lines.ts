import {
  guessPolarity,
  median,
  percentile,
  splitBimodal,
  STROKE_LEVEL,
  strokeContrast,
} from '../capture/pixels'
import type { GrayImage } from '../capture/pixels'

/**
 * Every measure but `shadedCells` takes the stroke contrast from `readLattice`, not the photograph,
 * so a bright lattice on a dark screen reads like dark ink on paper.
 */

/**
 * `xs` and `ys` each hold `n + 1` line positions, borders included, left to right and top to bottom.
 */
type Lattice<TSize extends number = number> = {
  n: TSize
  xs: Array<number>
  ys: Array<number>
}

/**
 * A border line spans at least half the frame; an interior line may show only in part, because a
 * cage border runs along some cells and not others.
 */
const BORDER_MIN_COVERAGE = 0.5
const INTERIOR_MIN_COVERAGE = 0.08

/**
 * Lines along the other axis keep the profile above zero, so a peak must rise this far above its
 * median.
 */
const PEAK_RISE = 0.06

/**
 * A peak this strong that no line explains means the candidate size is wrong.
 */
const UNEXPLAINED_MIN_COVERAGE = 0.35

/**
 * Fraction of the cell pitch a line may sit from where a uniform grid predicts it.
 */
const LINE_TOLERANCE = 0.3

/**
 * A second size scoring within this of the best is an ambiguity, and ambiguity means no answer.
 */
const MIN_SCORE_MARGIN = 0.3

type Peak = {
  position: number
  coverage: number
}

function strokeProfiles(contrast: GrayImage): { columns: Float32Array; rows: Float32Array } {
  const { width, height, data } = contrast
  const columns = new Float32Array(width)
  const rows = new Float32Array(height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[y * width + x] ?? 0) <= STROKE_LEVEL) {
        continue
      }
      columns[x] = (columns[x] ?? 0) + 1
      rows[y] = (rows[y] ?? 0) + 1
    }
  }
  for (let x = 0; x < width; x++) {
    columns[x] = (columns[x] ?? 0) / height
  }
  for (let y = 0; y < height; y++) {
    rows[y] = (rows[y] ?? 0) / width
  }
  return { columns, rows }
}

/**
 * A run above the floor is one peak, at its coverage-weighted centre so a thick line reports its
 * middle.
 */
function profilePeaks(profile: Float32Array): Array<Peak> {
  const { length } = profile
  const floor = Math.max(INTERIOR_MIN_COVERAGE, median([...profile]) + PEAK_RISE)

  const peaks: Array<Peak> = []
  let start = -1
  let weight = 0
  let moment = 0
  let best = 0
  for (let i = 0; i <= length; i++) {
    // Past the end reads as 0, which closes a run that reaches the edge.
    const value = profile[i] ?? 0
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
  /**
   * Borders included. Complete only when every predicted line matched, the only fit `bestFit`
   * returns.
   */
  lines: Array<number>
}

/**
 * The share of predicted interior lines with a peak near them, less the strong peaks left
 * unexplained. So a 9x9 read as 3x3 leaves six lines unexplained, and read as 18x18 misses every
 * half-cell line.
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
    if (!nearest) {
      continue
    }
    matched++
    explained.add(nearest)
    lines.push(nearest.position)
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
  const first = borders[0]
  const last = borders.at(-1)
  if (first === undefined || last === undefined || borders.length < 2) {
    return undefined
  }

  const fits = sizes
    .map((n) => fitSize(peaks, first, last, n))
    .toSorted((a, b) => b.score - a.score)
  const best = fits[0]
  const runnerUp = fits[1]
  return !best ||
    best.score < 1 ||
    (runnerUp !== undefined && best.score - runnerUp.score < MIN_SCORE_MARGIN)
    ? undefined
    : best
}

/**
 * `undefined` unless both axes agree on a size and no other size comes close: a wrong `n` would
 * mislead everything downstream.
 */
function detectLattice<TSize extends number>(
  contrast: GrayImage,
  sizes: ReadonlyArray<TSize>,
): Lattice<TSize> | undefined {
  const profiles = strokeProfiles(contrast)
  const vertical = bestFit(profilePeaks(profiles.columns), sizes)
  const horizontal = bestFit(profilePeaks(profiles.rows), sizes)
  if (vertical === undefined || horizontal === undefined) {
    return undefined
  }
  return vertical.n !== horizontal.n
    ? undefined
    : { n: vertical.n, xs: vertical.lines, ys: horizontal.lines }
}

/**
 * Wider than the heaviest stroke at 1024px, so a line stands out from its own surroundings.
 */
const CONTRAST_RADIUS = 20

/**
 * Also returns the stroke contrast, which every mass here is measured in.
 */
export function readLattice<TSize extends number>(
  gray: GrayImage,
  sizes: ReadonlyArray<TSize>,
): { contrast: GrayImage; lattice: Lattice<TSize> | undefined } {
  const contrast = strokeContrast(gray, CONTRAST_RADIUS, guessPolarity(gray))
  return { contrast, lattice: detectLattice(contrast, sizes) }
}

/**
 * The median along the segment of the contrast summed across the line, so a heavy line measures
 * several times a thin one and a clue printed against the line is ignored.
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
        sum += data[y * width + x] ?? 0
      }
    }
    samples.push(sum)
  }
  return samples.length === 0 ? 0 : median(samples)
}

function pitchOf(lattice: Lattice): number {
  return (
    ((lattice.xs.at(-1) ?? 0) -
      (lattice.xs[0] ?? 0) +
      (lattice.ys.at(-1) ?? 0) -
      (lattice.ys[0] ?? 0)) /
    (2 * lattice.n)
  )
}

/**
 * Wide enough to hold the heaviest stroke, narrow enough to skip text.
 */
function strokeHalfWidth(lattice: Lattice): number {
  return Math.max(4, Math.round(pitchOf(lattice) * 0.08))
}

/**
 * The part of each segment sampled: clear of the crossings at its ends and of a clue in its corner.
 */
const SEGMENT_INSET = 0.25

export type LineWeights = {
  /**
   * Interior lines only, `xs[1..n-1]`.
   */
  vertical: Array<number>
  horizontal: Array<number>
}

export function lineMasses(contrast: GrayImage, lattice: Lattice): LineWeights {
  const halfWidth = strokeHalfWidth(lattice)
  const { n, xs, ys } = lattice
  const vertical: Array<number> = []
  const horizontal: Array<number> = []
  for (let k = 1; k < n; k++) {
    vertical.push(segmentMass(contrast, 'x', xs[k] ?? 0, ys[0] ?? 0, ys[n] ?? 0, halfWidth))
    horizontal.push(segmentMass(contrast, 'y', ys[k] ?? 0, xs[0] ?? 0, xs[n] ?? 0, halfWidth))
  }
  return { vertical, horizontal }
}

/**
 * An interior edge, named by the row-major index of the cell on its top or left.
 */
export type GridEdge = {
  cell: number
  side: 'right' | 'bottom'
}

type EdgeMass = GridEdge & {
  mass: number
}

export function edgeMasses(contrast: GrayImage, lattice: Lattice): Array<EdgeMass> {
  const halfWidth = strokeHalfWidth(lattice)
  const { n, xs, ys } = lattice
  const edges: Array<EdgeMass> = []
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const cell = row * n + col
      const cellHeight = (ys[row + 1] ?? 0) - (ys[row] ?? 0)
      const cellWidth = (xs[col + 1] ?? 0) - (xs[col] ?? 0)
      if (col < n - 1) {
        edges.push({
          cell,
          side: 'right',
          mass: segmentMass(
            contrast,
            'x',
            xs[col + 1] ?? 0,
            (ys[row] ?? 0) + cellHeight * SEGMENT_INSET,
            (ys[row + 1] ?? 0) - cellHeight * SEGMENT_INSET,
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
            ys[row + 1] ?? 0,
            (xs[col] ?? 0) + cellWidth * SEGMENT_INSET,
            (xs[col + 1] ?? 0) - cellWidth * SEGMENT_INSET,
            halfWidth,
          ),
        })
      }
    }
  }
  return edges
}

/**
 * Keeps the lines around a cell from counting as ink.
 */
const CELL_INSET = 0.12

/**
 * Deeper inset for reading a cell's fill colour, clear of the stroke contrast around its lines.
 */
const SHADE_INSET = 0.3

/**
 * A fill this far from the others' marks a highlighted cell, as the apps photographed mark the
 * selected one.
 */
const SHADE_LEVEL = 40

function cellRect(
  lattice: Lattice,
  row: number,
  col: number,
  inset: number,
): { x0: number; x1: number; y0: number; y1: number } {
  const { xs, ys } = lattice
  const cellWidth = (xs[col + 1] ?? 0) - (xs[col] ?? 0)
  const cellHeight = (ys[row + 1] ?? 0) - (ys[row] ?? 0)
  return {
    x0: Math.round((xs[col] ?? 0) + cellWidth * inset),
    x1: Math.round((xs[col + 1] ?? 0) - cellWidth * inset),
    y0: Math.round((ys[row] ?? 0) + cellHeight * inset),
    y1: Math.round((ys[row + 1] ?? 0) - cellHeight * inset),
  }
}

/**
 * Row-major.
 */
export function cellInk(contrast: GrayImage, lattice: Lattice): Array<number> {
  const { n } = lattice
  const { width, data } = contrast
  const ink: Array<number> = []
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const { x0, x1, y0, y1 } = cellRect(lattice, row, col, CELL_INSET)
      let stroke = 0
      let total = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          total++
          if ((data[y * width + x] ?? 0) > STROKE_LEVEL) {
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
 * Reads the picture rather than the contrast, which is blind to a flat fill.
 */
export function shadedCells(gray: GrayImage, lattice: Lattice): Array<number> {
  const { n } = lattice
  const { width, data } = gray
  const levels: Array<number> = []
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const { x0, x1, y0, y1 } = cellRect(lattice, row, col, SHADE_INSET)
      const samples: Array<number> = []
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          samples.push(data[y * width + x] ?? 0)
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
 * `undefined` unless the masses fall into two groups at least `minSeparation` of the range apart:
 * a real lattice is cleanly bimodal, so anything muddier is a picture this cannot read.
 */
export function splitHeavy(
  masses: Array<number>,
  minSeparation: number,
): { isHeavy: (mass: number) => boolean } | undefined {
  const split = splitBimodal(masses)
  return split.high.length === 0 || split.separation < minSeparation
    ? undefined
    : { isHeavy: (mass) => mass > split.threshold }
}
