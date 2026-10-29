import { describe, expect, it } from 'vitest'

import { colOf, rowOf } from '../../grid/geometry'
import { compactLabels } from '../../grid/regions'
import { applyDraft, startDraft } from './cage-edit'
import { isClueSatisfied } from './cage-math'
import { CAGE_OPS, createGrid, createPuzzle } from './model'
import type { Cage, CageOp } from './model'
import { issueOf } from './test-cages'
import { findSolveBlocker } from './validate'

/**
 * Cages laid over a 4x4 of single cells, however disconnected, then compacted; they keep their ids
 * while each one's first cell comes before the next one's.
 */
function laidOut(cages: Array<[Cage, Array<number>]>): ReturnType<typeof createGrid> {
  const grid = createGrid(4)
  for (const [cageId, [cage, cells]] of cages.entries()) {
    grid.cages[cageId] = cage
    for (const cell of cells) {
      grid.cageOf[cell] = cageId
    }
  }
  const { labels, order } = compactLabels(grid.cageOf)
  return { n: grid.n, cageOf: labels, cages: order.map((cageId) => grid.cages[cageId]!) }
}

describe('cageIssue', () => {
  it('names a cage in two pieces before anything else about it', () => {
    // Cells 0 and 2 with cell 1 between them belonging to another cage; the arity and clue are
    // fine.
    const grid = laidOut([[{ op: '+', target: 3 }, [0, 2]]])
    expect(issueOf(grid, 0)).toBe('split')
    expect(issueOf(laidOut([[{ op: '+', target: 3 }, [0, 1]]]), 0)).toBeUndefined()
  })
})

/**
 * Every clue some values of `cells` meet on an `n` by `n` grid, keyed by operator. Cells sharing a
 * line differ; others may repeat.
 */
function reachableClues(n: number, cells: Array<number>): Map<CageOp, Set<number>> {
  const reached = new Map<CageOp, Set<number>>(CAGE_OPS.map((op) => [op, new Set<number>()]))
  const values: Array<number> = []
  const place = (position: number): void => {
    if (position === cells.length) {
      // Every clue these values could print: their sum and product, and for a pair the difference
      // and quotient of the larger by the smaller.
      const high = Math.max(...values)
      const low = Math.min(...values)
      const candidates = [
        values.reduce((a, b) => a + b),
        values.reduce((a, b) => a * b),
        high - low,
        high / low,
      ]
      for (const [op, targets] of reached) {
        for (const target of candidates) {
          if (isClueSatisfied(values, { op, target })) targets.add(target)
        }
      }
      return
    }
    const cell = cells[position]!
    for (let value = 1; value <= n; value++) {
      const isTakenOnLine = cells
        .slice(0, position)
        .some(
          (other, index) =>
            values[index] === value &&
            (rowOf(n, other) === rowOf(n, cell) || colOf(n, other) === colOf(n, cell)),
        )
      if (isTakenOnLine) continue
      values[position] = value
      place(position + 1)
    }
    values.length = position
  }
  place(0)
  return reached
}

describe('the range a clue can have', () => {
  // A clue wrongly refused blocks solving a puzzle as printed (`findSolveBlocker`).
  it('never refuses a clue some values meet', () => {
    for (let n = 4; n <= 8; n++) {
      // One cell, two and three along a row and an L whose ends may repeat.
      for (const cells of [[0], [0, 1], [0, 1, 2], [0, 1, n + 1]]) {
        for (const [op, targets] of reachableClues(n, cells)) {
          for (const target of targets) {
            const grid = createGrid(n)
            grid.cages[0] = { op, target }
            for (const cell of cells) grid.cageOf[cell] = 0
            expect(issueOf(grid, 0), JSON.stringify({ n, cells, op, target })).toBeUndefined()
          }
        }
      }
    }
  })

  it('refuses a clue at the edge of what the cells could ever meet', () => {
    // On a 4x4: two cells sharing a line hold different values, so they differ by 1 to 3, divide to
    // 2 to 4, add to 3 to 7 and multiply to 2 to 12, never 9. Three are held to sums of 3 to 12
    // and factors up to 4.
    for (const [cage, cells] of [
      [{ op: '-', target: 4 }, [0, 1]],
      [{ op: '/', target: 1 }, [0, 1]],
      [{ op: '+', target: 8 }, [0, 1]],
      [{ op: '*', target: 9 }, [0, 1]],
      [{ op: '+', target: 2 }, [0, 1, 2]],
      [{ op: '+', target: 13 }, [0, 1, 2]],
      [{ op: '*', target: 5 }, [0, 1, 2]],
    ] as Array<[Cage, Array<number>]>) {
      expect(issueOf(laidOut([[cage, cells]]), 0), JSON.stringify(cage)).toBe('out_of_range')
    }
  })
})

describe('findSolveBlocker', () => {
  it('counts cages without a clue, and names a broken one first', () => {
    const puzzle = createPuzzle(4)
    expect(findSolveBlocker(puzzle.grid)).toMatch(/^16 cages still need a clue/)
    // A division over three cells: the clue is set, and no three cells can satisfy it.
    const broken = applyDraft(puzzle, {
      ...startDraft(puzzle.grid, 0),
      cells: new Set([0, 1, 2]),
      cage: { op: '/', target: 2 },
    })
    expect(findSolveBlocker(broken.grid)).toMatch(/^1 cage is not valid yet.*row 1, column 1/)
  })
})
