import { describe, expect, it } from 'vitest'

import { SUDOKU_SIZES } from '../puzzles/sudoku/model'
import { readLattice } from './lines'
import { drawLattice } from './test-lattice'

describe('readLattice', () => {
  it.each([4, 16])('reads the size and lines of a grid %i cells across', (n) => {
    const picture = drawLattice({ n })
    const { lattice } = readLattice(picture, SUDOKU_SIZES.list)
    expect(lattice?.n).toBe(n)
    for (const [k, x] of lattice!.xs.entries()) expect(x).toBeCloseTo(picture.xs[k]!, -0.5)
    for (const [k, y] of lattice!.ys.entries()) expect(y).toBeCloseTo(picture.ys[k]!, -0.5)
  })

  it.each([
    ['a line is missing', drawLattice({ n: 9, missingVertical: [4] })],
    ['the two axes disagree', drawLattice({ n: 4, rows: 6 })],
    [
      'the paper is blank',
      { width: 64, height: 64, data: new Uint8ClampedArray(64 * 64).fill(255) },
    ],
  ])('guesses no size when %s', (_label, picture) => {
    expect(readLattice(picture, SUDOKU_SIZES.list).lattice).toBeUndefined()
  })
})
