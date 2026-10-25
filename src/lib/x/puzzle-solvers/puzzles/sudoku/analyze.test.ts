import { describe, expect, it } from 'vitest'

import { colOf, rowOf } from '../../grid/geometry'
import type { GridEdge } from '../../grid/lines'
import { drawLattice, toPixels } from '../../grid/test-lattice'
import { analyzeSudoku } from './analyze'
import type { SudokuHints } from './api'

/**
 * Box borders every `boxWidth` columns and `boxHeight` rows.
 */
function boxLines(n: number, boxWidth: number, boxHeight: number): (edge: GridEdge) => boolean {
  return ({ cell, side }) => {
    const isRight = side === 'right'
    const index = isRight ? colOf(n, cell) : rowOf(n, cell)
    return (index + 1) % (isRight ? boxWidth : boxHeight) === 0
  }
}

/**
 * Box columns at uneven places: after the third and the seventh column of a 9 by 9.
 */
function isUnevenBoxLine({ cell, side }: GridEdge): boolean {
  return side === 'right' ? [2, 6].includes(colOf(9, cell)) : (rowOf(9, cell) + 1) % 3 === 0
}

function analyzeDrawn(drawing: Parameters<typeof drawLattice>[0]): SudokuHints {
  return analyzeSudoku(toPixels(drawLattice(drawing)))
}

describe('analyzeSudoku', () => {
  it('reads the size, box geometry and empty cells of a clean grid', () => {
    const inked = [0, 10, 40, 80]
    const hints = analyzeDrawn({ n: 9, isHeavy: boxLines(9, 3, 3), inked })
    expect(hints).toMatchObject({ n: 9, boxWidth: 3, boxHeight: 3 })
    expect(hints.empty).toHaveLength(81 - inked.length)
    expect(hints.empty).not.toContainEqual({ row: 1, col: 1 })
    expect(hints.empty).toContainEqual({ row: 0, col: 1 })
  })

  it.each([
    [3, 2],
    [2, 3],
  ])('tells a 6 by 6 with boxes %i wide and %i tall from its transpose', (boxWidth, boxHeight) => {
    const hints = analyzeDrawn({ n: 6, isHeavy: boxLines(6, boxWidth, boxHeight) })
    expect(hints).toMatchObject({ n: 6, boxWidth, boxHeight })
  })

  it('offers no box geometry when no lines stand out', () => {
    const hints = analyzeDrawn({ n: 9, inked: [0] })
    expect(hints.n).toBe(9)
    expect(hints.boxWidth).toBeUndefined()
    expect(hints.boxHeight).toBeUndefined()
  })

  it('offers no box geometry when the heavy lines are not evenly spaced', () => {
    const hints = analyzeDrawn({ n: 9, isHeavy: isUnevenBoxLine })
    expect(hints.boxWidth).toBeUndefined()
  })

  it('offers no empty cells when nothing is filled to compare against', () => {
    const hints = analyzeDrawn({ n: 4, isHeavy: boxLines(4, 2, 2) })
    expect(hints.empty).toBeUndefined()
  })
})
