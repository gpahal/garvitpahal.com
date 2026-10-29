import { describe, expect, it } from 'vitest'

import type { PixelImage } from '../../capture/pixels'
import type { Capture } from '../../capture/rectify'
import type { GridEdge } from '../../grid/lines'
import { drawLattice } from '../../grid/test-lattice'
import { kenKenCompute, SEND_EDGE, SEND_MARGIN } from './compute'
import { createPuzzle, gridFingerprint } from './model'

const CAGE_EDGES: Array<GridEdge> = [
  { cell: 1, side: 'right' },
  { cell: 0, side: 'bottom' },
  { cell: 5, side: 'right' },
]

/**
 * A drawn 4x4 Ken Ken on a grey desk: the lattice, as a colour picture, inset in a larger frame.
 * Its paper is narrower than the margin sent, so the desk shows beyond it.
 */
function photographed(): Capture {
  const size = 320
  const lattice = drawLattice({
    n: 4,
    size,
    margin: size / 40,
    isHeavy: (edge) =>
      CAGE_EDGES.some((cage) => cage.cell === edge.cell && cage.side === edge.side),
  })
  const inset = size / 16
  const width = lattice.width + 2 * inset
  const height = lattice.height + 2 * inset
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isInside =
        x >= inset && y >= inset && x < inset + lattice.width && y < inset + lattice.height
      const value = isInside ? lattice.data[(y - inset) * lattice.width + (x - inset)]! : 128
      data.set([value, value, value, 255], (y * width + x) * 4)
    }
  }
  const left = inset + lattice.xs[0]!
  const right = inset + lattice.xs[4]!
  const top = inset + lattice.ys[0]!
  const bottom = inset + lattice.ys[4]!
  return {
    image: { width, height, data },
    quad: [
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ],
  }
}

function grayAt(image: PixelImage, x: number, y: number): number {
  return image.data[(Math.round(y) * image.width + Math.round(x)) * 4]!
}

describe('kenKenCompute.prepare', () => {
  it('sends the crop with room around the grid, and measures hints on the grid alone', () => {
    const capture = photographed()
    const { pixels, hints } = kenKenCompute.prepare(capture)
    const gridEdge = capture.quad[1].x - capture.quad[0].x
    // Never upscaled: the crop is the grid's own size plus the margin, not the frame.
    expect(pixels.width).toBe(Math.round(gridEdge * (1 + 2 * SEND_MARGIN)))
    expect(pixels.width).toBeLessThan(capture.image.width)
    expect(pixels.width).toBeLessThanOrEqual(SEND_EDGE)
    expect(pixels.height).toBe(pixels.width)

    // The heavy outer border sits in the margin's inner edge, so a corner placed on it still shows
    // the whole of it, and the desk shows beyond.
    const margin = (SEND_MARGIN / (1 + 2 * SEND_MARGIN)) * pixels.width
    expect(grayAt(pixels, margin, pixels.height / 2)).toBeLessThan(64)
    expect(grayAt(pixels, margin - 2, pixels.height / 2)).toBeLessThan(64)
    expect(grayAt(pixels, 1, pixels.height / 2)).toBe(128)

    // Only grid size and cell names: nothing positional that the margin could shift.
    expect(hints).toEqual({
      n: 4,
      heavyEdges: expect.arrayContaining([
        { a: 'B1', b: 'C1' },
        { a: 'A1', b: 'A2' },
        { a: 'B2', b: 'C2' },
      ]) as unknown,
    })
    expect((hints as { heavyEdges: Array<unknown> }).heavyEdges).toHaveLength(CAGE_EDGES.length)
  })
})

describe('kenKenCompute.fingerprint', () => {
  it('withholds the fingerprint of a read the parser caught contradicting itself', () => {
    const puzzle = createPuzzle(4)
    expect(kenKenCompute.fingerprint(puzzle)).toBe(gridFingerprint(puzzle.grid))
    const contradicted = { ...puzzle, unreviewedCages: [0], contradictions: [0] }
    expect(kenKenCompute.fingerprint(contradicted)).toBeUndefined()
  })
})
