import { describe, expect, it } from 'vitest'

import { describeHints, sudokuHintsSchema } from './hints'

/**
 * Every cell of an `n` by `n` grid except `filled`, which are `[row, col]` pairs.
 */
function emptyExcept(n: number, filled: Array<[number, number]>) {
  const empty: Array<{ row: number; col: number }> = []
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (filled.every(([r, c]) => r !== row || c !== col)) empty.push({ row, col })
    }
  }
  return empty
}

describe('sudokuHintsSchema', () => {
  it('accepts hints that describe the grid they name', () => {
    const hints = { n: 6, boxWidth: 3, boxHeight: 2, empty: [{ row: 5, col: 0 }] }
    expect(sudokuHintsSchema.safeParse(hints).success).toBe(true)
  })

  it('refuses a cell outside the grid, which would alias another cell', () => {
    expect(sudokuHintsSchema.safeParse({ n: 4, empty: [{ row: 0, col: 5 }] }).success).toBe(false)
  })

  it('refuses boxes that do not tile the grid, or tile it only as its rows', () => {
    expect(sudokuHintsSchema.safeParse({ n: 6, boxWidth: 3, boxHeight: 3 }).success).toBe(false)
    expect(sudokuHintsSchema.safeParse({ n: 9, boxWidth: 9, boxHeight: 1 }).success).toBe(false)
  })

  it('checks nothing against a size it was not given', () => {
    expect(sudokuHintsSchema.safeParse({ empty: [{ row: 9, col: 9 }] }).success).toBe(true)
  })
})

describe('describeHints', () => {
  it('gives the measured size and boxes, names the cells that hold a digit, or says none does', () => {
    const prompt = describeHints({
      n: 4,
      boxWidth: 2,
      boxHeight: 2,
      empty: emptyExcept(4, [
        [0, 0],
        [3, 2],
      ]),
    })
    expect(prompt).toContain('- The grid is 4x4 with boxes 2 cells wide and 2 cells tall.\n')
    expect(prompt).toContain(
      '- Only these cells appear to hold a printed digit: A1, C4. Every other cell appears empty.\n',
    )
    expect(describeHints({ n: 4, empty: emptyExcept(4, []) })).toContain(
      '- The grid is 4x4.\n- No cell appears to hold a printed digit.\n',
    )
    expect(describeHints({})).toBe('')
  })
})
