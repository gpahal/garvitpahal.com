import { describe, expect, it } from 'vitest'

import { kenKenPuzzleWireSchema, puzzleToWire } from '../api'
import type { KenKenPuzzle } from '../model'
import { parseKenKen } from './parse'
import type { KenKenRaw } from './parse'

type RawCage = KenKenRaw['cages'][number]

/**
 * A 4x4 of dominoes whose clue cells are named out of reading order in `cages`, each clue with its
 * own target so a test can tell them apart.
 */
const CLUES: Array<Pick<RawCage, 'op' | 'target'>> = [
  { op: '+', target: 5 },
  { op: '+', target: 7 },
  { op: '*', target: 2 },
  { op: '*', target: 3 },
  { op: '*', target: 4 },
  { op: '*', target: 6 },
  { op: '*', target: 8 },
  { op: '*', target: 12 },
]

const raw: KenKenRaw = {
  n: 4,
  cellCages: [
    ['A1', 'A1', 'C1', 'C1'],
    ['A2', 'A2', 'C2', 'C2'],
    ['A3', 'A3', 'C3', 'C3'],
    ['A4', 'A4', 'C4', 'C4'],
  ],
  cages: ['C4', 'A4', 'C3', 'A3', 'C2', 'A2', 'C1', 'A1'].map((clueCell, index) => ({
    clueCell,
    ...CLUES[index]!,
    cellCount: 2,
  })),
  uncertain: [],
}

const cageNamed = (clueCell: string): RawCage =>
  raw.cages.find((cage) => cage.clueCell === clueCell)!

/**
 * `raw` with the cage that prints its clue at `clueCell` replaced.
 */
function withCage(clueCell: string, patch: Partial<RawCage>): KenKenRaw {
  const cages = raw.cages.map((cage) => (cage.clueCell === clueCell ? { ...cage, ...patch } : cage))
  return { ...raw, cages }
}

/**
 * Also checks the result passes the page's wire schema after JSON, or a paid read would end in a
 * reload notice.
 */
function parsed(input: KenKenRaw): KenKenPuzzle {
  const result = parseKenKen(input)
  if (!result.ok) {
    throw new Error(result.message)
  }
  const body = JSON.stringify(puzzleToWire(result.puzzle))
  const sent: unknown = JSON.parse(body)
  expect(kenKenPuzzleWireSchema.safeParse(sent).success).toBe(true)
  return result.puzzle
}

describe('parseKenKen', () => {
  it('numbers cages in reading order and pairs each with the clue read for its cell', () => {
    const { grid, contradictions, unreviewedCages } = parsed(raw)
    expect([...grid.cageOf]).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7])
    expect(grid.cages.map(({ target }) => target)).toEqual([12, 8, 6, 4, 3, 2, 7, 5])
    expect(contradictions).toEqual([])
    expect(unreviewedCages).toEqual([])
  })

  it('refuses a layout that names a cell outside the grid', () => {
    const cellCages = raw.cellCages.map((row) => [...row])
    cellCages[0]![0] = 'E1'
    expect(parseKenKen({ ...raw, cellCages })).toEqual({
      ok: false,
      message: 'Row 1 names a cell outside the grid: E1',
    })
  })

  it('refuses a layout with a cage no clue was read for', () => {
    const cages = raw.cages.filter((cage) => cage.clueCell !== 'A1')
    expect(parseKenKen({ ...raw, cages })).toMatchObject({ ok: false })
  })

  it('keeps the last of two clues read for one cell, and flags the cage', () => {
    const cages = [...raw.cages, { ...cageNamed('A1'), target: 99 }]
    const { grid, contradictions } = parsed({ ...raw, cages })
    expect(grid.cages[0]).toEqual({ op: '*', target: 99 })
    expect(contradictions).toEqual([0])
  })

  it('flags a clue named for a cell other than the first of its cage', () => {
    // The first domino is named for its right-hand cell. Its count and clue are otherwise fine.
    const cellCages = raw.cellCages.map((row) => [...row])
    cellCages[0]![0] = 'B1'
    cellCages[0]![1] = 'B1'
    const cages = raw.cages.map((cage) =>
      cage.clueCell === 'A1' ? { ...cage, clueCell: 'B1' } : cage,
    )
    const { grid, contradictions } = parsed({ ...raw, cellCages, cages })
    expect([...grid.cageOf.slice(0, 2)]).toEqual([0, 0])
    expect(contradictions).toEqual([0])
  })

  it('flags a cell count that disagrees with the layout, without repairing either', () => {
    const { grid, contradictions } = parsed(withCage('C2', { cellCount: 3 }))
    expect([...grid.cageOf]).toEqual([...parsed(raw).grid.cageOf])
    expect(contradictions).toEqual([3])
  })

  it('flags one name traced over two regions that do not touch', () => {
    // The second row's right-hand domino is also named A1, so A1 is two pieces and C2 is gone.
    const cellCages = raw.cellCages.map((row) => [...row])
    cellCages[1]![2] = 'A1'
    cellCages[1]![3] = 'A1'
    const cages = raw.cages
      .filter((cage) => cage.clueCell !== 'C2')
      .map((cage) => (cage.clueCell === 'A1' ? { ...cage, cellCount: 4 } : cage))
    const { grid, contradictions } = parsed({ ...raw, cellCages, cages })
    expect([...grid.cageOf.slice(0, 8)]).toEqual([0, 0, 1, 1, 2, 2, 0, 0])
    expect(contradictions).toEqual([0])
  })

  it('flags a clue the editor would refuse, such as a given above n', () => {
    // The first domino split into two single cells, one given too large for a 4x4.
    const cellCages = raw.cellCages.map((row) => [...row])
    cellCages[0]![1] = 'B1'
    const cages = [
      ...raw.cages.map((cage) =>
        cage.clueCell === 'A1' ? { ...cage, op: '=' as const, target: 1, cellCount: 1 } : cage,
      ),
      { clueCell: 'B1', op: '=' as const, target: 5, cellCount: 1 },
    ]
    const { grid, contradictions } = parsed({ ...raw, cellCages, cages })
    expect(grid.cages[1]).toEqual({ op: '=', target: 5 })
    expect(contradictions).toEqual([1])
  })

  it('flags a cage traced over a cell a clue was read for', () => {
    // The first row traced as one cage, while C1's clue is still read: two cages merged into A1.
    const cellCages = raw.cellCages.map((row) => [...row])
    cellCages[0] = ['A1', 'A1', 'A1', 'A1']
    const cages = raw.cages.map((cage) =>
      cage.clueCell === 'A1' ? { ...cage, op: '+' as const, target: 10, cellCount: 4 } : cage,
    )
    const { grid, contradictions, unreviewedCages } = parsed({ ...raw, cellCages, cages })
    expect(grid.cages[0]).toEqual({ op: '+', target: 10 })
    expect(contradictions).toEqual([0])
    expect(unreviewedCages).toEqual([0])
  })

  it('ignores a clue or a doubt about a cell outside this grid', () => {
    // Legal names for an 8x8, which is what the schema admits, but not for this 4x4.
    const cages = [...raw.cages, { clueCell: 'H8', op: '+' as const, target: 1, cellCount: 1 }]
    const { grid, contradictions, unreviewedCages } = parsed({
      ...raw,
      cages,
      uncertain: ['E5'],
    })
    expect(grid.cages).toHaveLength(8)
    expect(contradictions).toEqual([])
    expect(unreviewedCages).toEqual([])
  })

  it('lists the contradictions first, then what the model was unsure of, each cage once', () => {
    const { contradictions, unreviewedCages } = parsed({
      ...withCage('A1', { cellCount: 3 }),
      uncertain: ['C1', 'A1', 'C1'],
    })
    expect(contradictions).toEqual([0])
    expect(unreviewedCages).toEqual([0, 1])
  })
})
