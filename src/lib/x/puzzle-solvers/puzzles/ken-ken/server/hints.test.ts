import { describe, expect, it } from 'vitest'

import { cellName, orthogonalNeighbours } from '../../../grid/geometry'
import { describeHints, kenKenHintsSchema } from './hints'

/**
 * The heavy edges of a 4x4 of dominoes, two to a row, as the browser measures them: one between
 * every two touching cells in different cages.
 */
function dominoEdges(): Array<{ a: string; b: string }> {
  const edges: Array<{ a: string; b: string }> = []
  for (let cell = 0; cell < 16; cell++) {
    for (const neighbour of orthogonalNeighbours(4, cell)) {
      if (neighbour > cell && Math.floor(neighbour / 2) !== Math.floor(cell / 2)) {
        edges.push({ a: cellName(4, cell), b: cellName(4, neighbour) })
      }
    }
  }
  return edges
}

describe('kenKenHintsSchema', () => {
  it('accepts hints that describe the grid they name', () => {
    const hints = {
      n: 4,
      heavyEdges: [
        { a: 'A1', b: 'B1' },
        { a: 'D3', b: 'D4' },
      ],
      unreadCells: ['D4'],
    }
    expect(kenKenHintsSchema.safeParse(hints).success).toBe(true)
  })

  it('refuses a cell outside the grid', () => {
    expect(kenKenHintsSchema.safeParse({ n: 4, unreadCells: ['E1'] }).success).toBe(false)
    expect(kenKenHintsSchema.safeParse({ n: 4, heavyEdges: [{ a: 'D4', b: 'D5' }] }).success).toBe(
      false,
    )
  })

  it('refuses an edge between cells that do not touch', () => {
    expect(kenKenHintsSchema.safeParse({ n: 4, heavyEdges: [{ a: 'A1', b: 'C1' }] }).success).toBe(
      false,
    )
    expect(kenKenHintsSchema.safeParse({ n: 4, heavyEdges: [{ a: 'A1', b: 'B2' }] }).success).toBe(
      false,
    )
  })
})

describe('describeHints', () => {
  it('lists the cages the measured borders enclose, and any that may reach an unread cell', () => {
    const prompt = describeHints({ n: 4, heavyEdges: dominoEdges(), unreadCells: ['D4'] })
    expect(prompt).toContain('- The grid is 4x4.\n')
    expect(prompt).toContain(
      '- The heavy borders enclose these cages: {A1, B1} {C1, D1} {A2, B2} {C2, D2} {A3, B3} {A4, B4}.\n',
    )
    expect(prompt).toContain('- Cells C3, D3 are in one cage, which may also include D4.\n')
    expect(prompt).toContain('- Cell C4 is in one cage, which may also include D4.\n')
    expect(prompt).toContain(
      '- The borders of D4 could not be measured, so trace that part of the grid from the picture.\n',
    )
  })
})
