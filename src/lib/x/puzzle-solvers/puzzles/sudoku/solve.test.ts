import { describe, expect, it } from 'vitest'

import { createGrid, findConflicts } from './model'
import type { SudokuGrid } from './model'
import { solveSudoku } from './solve'

const OPTIONS = { timeoutMs: 1000 }

function grid(n: number, boxWidth: number, boxHeight: number, values: Array<number>): SudokuGrid {
  const next = createGrid(n, boxWidth, boxHeight)
  next.values.set(values)
  return next
}

describe('solveSudoku', () => {
  it('solves a 4x4 with one completion and proves it unique', () => {
    // prettier-ignore
    const puzzle = grid(4, 2, 2, [
      1, 2, 0, 4,
      0, 4, 1, 0,
      0, 1, 4, 0,
      4, 0, 0, 1,
    ])
    const result = solveSudoku(puzzle, OPTIONS)
    expect(result.status).toBe('solved')
    if (result.status !== 'solved') {
      return
    }
    expect(result.isUnique).toBe(true)
    // prettier-ignore
    expect([...result.solution]).toEqual([
      1, 2, 3, 4,
      3, 4, 1, 2,
      2, 1, 4, 3,
      4, 3, 2, 1,
    ])
  })

  it('reports a grid whose 2s and 3s can swap as multiple', () => {
    // The unique puzzle above without its one 2: every open cell is 2 or 3, two ways round.
    // prettier-ignore
    const puzzle = grid(4, 2, 2, [
      1, 0, 0, 4,
      0, 4, 1, 0,
      0, 1, 4, 0,
      4, 0, 0, 1,
    ])
    const result = solveSudoku(puzzle, OPTIONS)
    expect(result.status).toBe('multiple')
  })

  it('reports two givens in one box as unsolvable, which is what a misread looks like', () => {
    // prettier-ignore
    const puzzle = grid(4, 2, 2, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ])
    expect(solveSudoku(puzzle, OPTIONS)).toEqual({ status: 'unsolvable' })
  })

  it('holds a 6x6 to its 3x2 boxes rather than 2x3 ones', () => {
    // Cell (1, 2) has 3 above it in its column and 4 in its row. The 3-wide box also holds 1 and
    // 2, which leaves 5 or 6. A 2-wide box would hold only 3 and 4, and allow 1 or 2 there too.
    // prettier-ignore
    const puzzle = grid(6, 3, 2, [
      1, 2, 3, 4, 5, 6,
      4, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0,
    ])
    const result = solveSudoku(puzzle, OPTIONS)
    expect(result.status).toBe('multiple')
    if (result.status !== 'multiple') {
      return
    }
    expect([5, 6]).toContain(result.solution[8])
  })

  it.each([
    [12, 4, 3],
    [16, 4, 4],
  ])('fills a %i-wide grid of %ix%i boxes from two givens in five', (n, boxWidth, boxHeight) => {
    // A full grid by the usual shifted-row pattern, then three cells in five emptied.
    const full = Array.from({ length: n * n }, (_, cell) => {
      const row = Math.floor(cell / n)
      return (((row % boxHeight) * boxWidth + Math.floor(row / boxHeight) + (cell % n)) % n) + 1
    })
    const givens = full.map((value, cell) => ((cell * 7) % 5 < 2 ? value : 0))
    const result = solveSudoku(grid(n, boxWidth, boxHeight, givens), { timeoutMs: 5000 })
    expect(['solved', 'multiple']).toContain(result.status)
    if (result.status !== 'solved' && result.status !== 'multiple') {
      return
    }
    const solved = grid(n, boxWidth, boxHeight, [...result.solution])
    expect(solved.values.every((value) => value >= 1 && value <= n)).toBe(true)
    expect(findConflicts(solved)).toEqual([])
    expect(givens.every((value, cell) => value === 0 || solved.values[cell] === value)).toBe(true)
  })

  it('finds two solutions of a sparse grid that thrashed plain minimum-remaining-values', () => {
    const givens =
      '.....6....59.....82....8....45........3........6..3.54...325..6..................'
    const puzzle = grid(
      9,
      3,
      3,
      Array.from(givens, (c) => (c === '.' ? 0 : Number(c))),
    )
    expect(solveSudoku(puzzle, OPTIONS).status).toBe('multiple')
  })
})
