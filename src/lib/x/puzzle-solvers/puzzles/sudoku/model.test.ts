import { describe, expect, it } from 'vitest'

import {
  createGrid,
  defaultBoxGeometry,
  describeConflict,
  EMPTY,
  findConflicts,
  gridFingerprint,
  resizeGrid,
  SUDOKU_SIZES,
  willResizeDropValues,
} from './model'
import type { SudokuGrid } from './model'

describe('resizeGrid', () => {
  it('keeps the top-left block where it was, so a cell reference still names its cell', () => {
    const grid = createGrid(9, 3, 3)
    grid.values[1 * 9 + 2] = 4
    grid.values[1 * 9 + 3] = 9
    const smaller = resizeGrid(grid, 6, 3, 2)
    expect(smaller.values[1 * 6 + 2]).toBe(4)
    // 9 cannot exist on a 6x6.
    expect(smaller.values[1 * 6 + 3]).toBe(EMPTY)
  })
})

function filledCount(grid: SudokuGrid): number {
  return grid.values.filter((value) => value !== EMPTY).length
}

describe('willResizeDropValues', () => {
  it('agrees with what resizeGrid keeps', () => {
    const grid = createGrid(9, 3, 3)
    for (const [cell, value] of [
      [0, 4],
      [1 * 9 + 5, 7],
      [4 * 9 + 4, 5],
      [7 * 9 + 2, 2],
    ] as const) {
      grid.values[cell] = value
    }
    for (const n of SUDOKU_SIZES.list) {
      const { boxWidth, boxHeight } = defaultBoxGeometry(n)
      const resized = resizeGrid(grid, n, boxWidth, boxHeight)
      expect(willResizeDropValues(grid, n)).toBe(filledCount(resized) < filledCount(grid))
    }
  })
})

/**
 * A 4x4 with 2x2 boxes and the given values placed.
 */
function gridWith(placed: Record<number, number>): SudokuGrid {
  const grid = createGrid(4, 2, 2)
  for (const [cell, value] of Object.entries(placed)) {
    grid.values[Number(cell)] = value
  }
  return grid
}

describe('findConflicts and describeConflict', () => {
  it('mark both cells of each clash and name the first, rows before columns before boxes', () => {
    const cases: Array<[Record<number, number>, Array<number>, string | undefined]> = [
      [{ 4: 3, 7: 3, 1: 2, 13: 2 }, [1, 4, 7, 13], 'Row 2 has more than one 3'],
      [{ 1: 2, 13: 2 }, [1, 13], 'Column 2 has more than one 2'],
      // Cells 10 and 15 share only the bottom-right box, the fourth.
      [{ 10: 4, 15: 4 }, [10, 15], 'Box 4 has more than one 4'],
      // Repeats on the long diagonals of two different boxes share no group.
      [{ 0: 1, 5: 2, 10: 1, 15: 2 }, [], undefined],
    ]
    for (const [placed, cells, conflict] of cases) {
      const grid = gridWith(placed)
      expect(findConflicts(grid).toSorted((a, b) => a - b)).toEqual(cells)
      expect(describeConflict(grid)).toBe(
        conflict === undefined ? undefined : `${conflict}. Fix the highlighted cells`,
      )
    }
  })
})

describe('gridFingerprint', () => {
  it('tells apart grids whose values only differ in where two-digit ones fall', () => {
    const first = createGrid(16, 4, 4)
    first.values.set([1, 0, 12])
    const second = createGrid(16, 4, 4)
    second.values.set([10, 1, 2])
    expect(gridFingerprint(first)).not.toBe(gridFingerprint(second))
  })

  it('is the same for the same grid read twice, and differs by box orientation', () => {
    const grid = createGrid(6, 3, 2)
    grid.values[0] = 5
    expect(gridFingerprint(grid)).toBe(gridFingerprint(resizeGrid(grid, 6, 3, 2)))
    expect(gridFingerprint(grid)).not.toBe(gridFingerprint(resizeGrid(grid, 6, 2, 3)))
  })
})
