import type { GrayImage, PixelImage } from '../capture/pixels'
import type { GridEdge } from './lines'

const PAPER = 255
const INK = 0
const SHADE = 170
const THIN = 2
const HEAVY = 6

type LatticeDrawing = {
  n: number
  /**
   * Differing from `n`, to draw a picture no square size fits.
   */
  rows?: number
  size?: number
  margin?: number
  isHeavy?: (edge: GridEdge) => boolean
  /**
   * Indices 1..n-1 of the vertical lines.
   */
  missingVertical?: Array<number>
  inked?: Array<number>
  shaded?: Array<number>
}

/**
 * Dark strokes on white paper; `xs` and `ys` say where each line was drawn.
 */
export function drawLattice({
  n,
  rows = n,
  size = 480,
  margin = 16,
  isHeavy = () => false,
  missingVertical = [],
  inked = [],
  shaded = [],
}: LatticeDrawing): GrayImage & { xs: Array<number>; ys: Array<number> } {
  const data = new Uint8ClampedArray(size * size).fill(PAPER)
  const xs = Array.from({ length: n + 1 }, (_, k) => margin + (k * (size - 2 * margin)) / n)
  const ys = Array.from({ length: rows + 1 }, (_, k) => margin + (k * (size - 2 * margin)) / rows)

  const fill = (x0: number, y0: number, x1: number, y1: number, value: number): void => {
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(size, Math.round(y1)); y++) {
      for (let x = Math.max(0, Math.round(x0)); x < Math.min(size, Math.round(x1)); x++) {
        data[y * size + x] = value
      }
    }
  }
  const vertical = (x: number, y0: number, y1: number, width: number): void => {
    fill(x - width / 2, y0 - width / 2, x + width / 2, y1 + width / 2, INK)
  }
  const horizontal = (y: number, x0: number, x1: number, width: number): void => {
    fill(x0 - width / 2, y - width / 2, x1 + width / 2, y + width / 2, INK)
  }

  const top = ys[0]!
  const bottom = ys[rows]!
  const left = xs[0]!
  const right = xs[n]!
  for (const cell of shaded) {
    const row = Math.floor(cell / n)
    const col = cell % n
    fill(xs[col]!, ys[row]!, xs[col + 1]!, ys[row + 1]!, SHADE)
  }
  for (const [k, x] of xs.entries()) {
    const isBorder = k === 0 || k === n
    if (isBorder || !missingVertical.includes(k)) vertical(x, top, bottom, isBorder ? HEAVY : THIN)
  }
  for (const [k, y] of ys.entries()) {
    horizontal(y, left, right, k === 0 || k === rows ? HEAVY : THIN)
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < n; col++) {
      const cell = row * n + col
      if (col < n - 1 && isHeavy({ cell, side: 'right' })) {
        vertical(xs[col + 1]!, ys[row]!, ys[row + 1]!, HEAVY)
      }
      if (row < rows - 1 && isHeavy({ cell, side: 'bottom' })) {
        horizontal(ys[row + 1]!, xs[col]!, xs[col + 1]!, HEAVY)
      }
    }
  }
  // An outlined box a third of the cell across, about as much ink as a printed digit.
  for (const cell of inked) {
    const row = Math.floor(cell / n)
    const col = cell % n
    const cx = (xs[col]! + xs[col + 1]!) / 2
    const cy = (ys[row]! + ys[row + 1]!) / 2
    const half = (xs[col + 1]! - xs[col]!) / 6
    vertical(cx - half, cy - half, cy + half, 3)
    vertical(cx + half, cy - half, cy + half, 3)
    horizontal(cy - half, cx - half, cx + half, 3)
    horizontal(cy + half, cx - half, cx + half, 3)
  }
  return { width: size, height: size, data, xs, ys }
}

export function toPixels(gray: GrayImage): PixelImage {
  const data = new Uint8ClampedArray(gray.width * gray.height * 4)
  for (const [i, value] of gray.data.entries()) {
    data.set([value, value, value, 255], i * 4)
  }
  return { width: gray.width, height: gray.height, data }
}
