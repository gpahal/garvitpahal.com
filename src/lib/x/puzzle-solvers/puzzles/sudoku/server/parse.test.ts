import { describe, expect, it } from 'vitest'

import { puzzleToWire, sudokuPuzzleWireSchema } from '../api'
import { parseSudoku } from './parse'
import type { SudokuRaw } from './parse'

const raw: SudokuRaw = {
  n: 4,
  boxWidth: 2,
  boxHeight: 2,
  cells: [
    [1, 0, 0, 4],
    [0, 4, 1, 0],
    [0, 1, 4, 0],
    [4, 0, 0, 1],
  ],
  uncertain: ['B1'],
}

/**
 * Also checks the result passes the page's wire schema after JSON, or a paid read would end in a
 * reload notice.
 */
function parsed(input: SudokuRaw) {
  const result = parseSudoku(input)
  if (!result.ok) {
    throw new Error(result.message)
  }
  const body = JSON.stringify(puzzleToWire(result.puzzle))
  const sent: unknown = JSON.parse(body)
  expect(sudokuPuzzleWireSchema.safeParse(sent).success).toBe(true)
  return result.puzzle
}

describe('parseSudoku', () => {
  it('lays the rows out row-major with the boxes the model read', () => {
    const { grid, uncertain } = parsed(raw)
    expect([...grid.values]).toEqual([1, 0, 0, 4, 0, 4, 1, 0, 0, 1, 4, 0, 4, 0, 0, 1])
    expect([grid.boxWidth, grid.boxHeight]).toEqual([2, 2])
    expect(uncertain).toEqual([{ row: 0, col: 1 }])
  })

  it('replaces boxes that do not tile, marking the fallback guessed only if it could lie the other way', () => {
    const { grid, unusableBoxes, boxesGuessed } = parsed({ ...raw, boxWidth: 3, boxHeight: 3 })
    expect([grid.boxWidth, grid.boxHeight]).toEqual([2, 2])
    // The boxes read go to the log.
    expect(unusableBoxes).toEqual({ boxWidth: 3, boxHeight: 3 })
    expect(parsed(raw).unusableBoxes).toBeUndefined()
    // A 4x4 has only one way to tile, so its fallback is no guess.
    expect(boxesGuessed).toBeUndefined()

    const six: SudokuRaw = {
      n: 6,
      boxWidth: 3,
      boxHeight: 3,
      cells: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => 0)),
      uncertain: [],
    }
    const guessed = parsed(six)
    expect([guessed.grid.boxWidth, guessed.grid.boxHeight]).toEqual([3, 2])
    expect(guessed.boxesGuessed).toBe(true)
    expect(parsed({ ...six, boxWidth: 2, boxHeight: 3 }).boxesGuessed).toBeUndefined()
  })

  it('empties a value too large for this grid and flags it for review, once however named', () => {
    const cells = raw.cells.map((row) => [...row])
    cells[0]![1] = 9
    cells[3]![2] = 12
    const { grid, uncertain } = parsed({ ...raw, cells })
    expect(grid.values[1]).toBe(0)
    expect(uncertain).toEqual([
      { row: 0, col: 1 },
      { row: 3, col: 2 },
    ])
  })

  it('names an uncertain cell once however often the model did, and only inside the grid', () => {
    // E1 and A5 are legal names for a 16x16, which is what the schema admits, but not for this 4x4.
    const named = ['B1', 'A2', 'B1', 'E1', 'A5']
    expect(parsed({ ...raw, uncertain: named }).uncertain).toEqual([
      { row: 0, col: 1 },
      { row: 1, col: 0 },
    ])
  })

  it('refuses rows that do not make a square', () => {
    expect(parseSudoku({ ...raw, cells: raw.cells.slice(1) })).toMatchObject({ ok: false })
    const cells = raw.cells.map((row) => [...row])
    cells[2] = [1, 2, 3]
    expect(parseSudoku({ ...raw, cells })).toMatchObject({ ok: false })
  })
})
