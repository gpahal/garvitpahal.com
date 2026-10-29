import { describe, expect, it } from 'vitest'

import type { GridEdge } from '../../grid/lines'
import { drawLattice, toPixels } from '../../grid/test-lattice'
import { analyzeKenKen } from './analyze'
import type { KenKenHints } from './api'

/**
 * A 4 by 4 in four cages: the top row in two halves, and the rows below in two halves.
 */
const CAGE_EDGES: Array<GridEdge> = [
  { cell: 1, side: 'right' },
  { cell: 0, side: 'bottom' },
  { cell: 1, side: 'bottom' },
  { cell: 2, side: 'bottom' },
  { cell: 3, side: 'bottom' },
  { cell: 5, side: 'right' },
  { cell: 9, side: 'right' },
  { cell: 13, side: 'right' },
]

function isCageEdge(edge: GridEdge): boolean {
  return CAGE_EDGES.some((cage) => cage.cell === edge.cell && cage.side === edge.side)
}

function analyzeDrawn(drawing: Parameters<typeof drawLattice>[0]): KenKenHints {
  return analyzeKenKen(toPixels(drawLattice(drawing)))
}

describe('analyzeKenKen', () => {
  it('names every heavy edge by the two cells it separates', () => {
    const hints = analyzeDrawn({ n: 4, isHeavy: isCageEdge })
    expect(hints.n).toBe(4)
    expect(hints.heavyEdges).toHaveLength(CAGE_EDGES.length)
    expect(hints.heavyEdges).toEqual(
      expect.arrayContaining([
        { a: 'B1', b: 'C1' },
        { a: 'A1', b: 'A2' },
        { a: 'B4', b: 'C4' },
      ]),
    )
    expect(hints.unreadCells).toBeUndefined()
  })

  it('finds a highlighted cell that enhancement flattens, and leaves its edges unclassified', () => {
    const hints = analyzeDrawn({ n: 4, isHeavy: isCageEdge, shaded: [10] })
    expect(hints.unreadCells).toEqual(['C3'])
    const touched = hints.heavyEdges?.flatMap((edge) => [edge.a, edge.b])
    expect(touched).not.toContain('C3')
    expect(hints.heavyEdges).toContainEqual({ a: 'B1', b: 'C1' })
  })
})
