import { describe, expect, it } from 'vitest'

import { connectedComponents } from '../../grid/regions'
import {
  applyDraft,
  draftIssue,
  isDraftUnchanged,
  startDraft,
  toggleDraftCell,
  withDraftCells,
} from './cage-edit'
import type { CageDraft } from './cage-edit'
import { cageCells, cageIdAt, createPuzzle } from './model'
import type { KenKenPuzzle } from './model'
import { issueOf } from './test-cages'
import { findCageIssues } from './validate'

/**
 * Clicks `cells` of a 4x4 into the draft one at a time, as the editor does.
 */
function grow(draft: CageDraft, cells: Array<number>): CageDraft {
  let next = draft
  for (const cell of cells) {
    const toggled = toggleDraftCell(4, next.cells, cell)
    expect(toggled).toBeDefined()
    next = withDraftCells(next, toggled!)
  }
  return next
}

function expectPartition(puzzle: KenKenPuzzle): void {
  const { grid } = puzzle
  for (const cageId of grid.cages.keys()) {
    const cells = cageCells(grid, cageId)
    expect(cells.length).toBeGreaterThan(0)
    expect(connectedComponents(grid.n, cells)).toHaveLength(1)
  }
}

const blank = createPuzzle(4)

/**
 * A 4x4 whose first three top-row cells are one `+ 6` cage and every other cell its own.
 */
const row = applyDraft(blank, {
  ...grow(startDraft(blank.grid, 0), [1, 2]),
  cage: { op: '+', target: 6 },
})

describe('applyDraft', () => {
  it('leaves a hand-built cage needing a clue rather than flagged for an operator nobody chose', () => {
    const committed = applyDraft(blank, grow(startDraft(blank.grid, 0), [1]))
    const cageId = committed.grid.cageOf[0]!
    expect(cageCells(committed.grid, cageId)).toEqual([0, 1])
    expect(issueOf(committed.grid, cageId)).toBe('unset')
    expect(findCageIssues(committed.grid).size).toBe(0)
  })

  it('takes the clue along with the draft, leaving what the origin kept blank', () => {
    // The row's first cell drafted away with the cell below it.
    const committed = applyDraft(row, grow(startDraft(row.grid, 0), [2, 1, 4]))
    expectPartition(committed)
    expect(cageCells(committed.grid, cageIdAt(committed.grid, 0))).toEqual([0, 4])
    expect(committed.grid.cages[cageIdAt(committed.grid, 0)]).toEqual({ op: '+', target: 6 })
    expect(cageCells(committed.grid, cageIdAt(committed.grid, 1))).toEqual([1, 2])
    expect(committed.grid.cages[cageIdAt(committed.grid, 1)]).toEqual({ op: '+', target: 0 })
  })

  it('keeps the clue and flags on a cage that only lost a cell, and renumbers them with the rest', () => {
    // Cage 0 is the row; cell 5 is cage 3 once the ids are compacted around it.
    expect(cageIdAt(row.grid, 5)).toBe(3)
    const flagged: KenKenPuzzle = { ...row, unreviewedCages: [0, 3], contradictions: [0] }
    // Cell 6 takes cell 2 from the row, which keeps cells 0 and 1 and is still in doubt.
    const committed = applyDraft(flagged, grow(startDraft(flagged.grid, 6), [2]))
    expect(cageCells(committed.grid, cageIdAt(committed.grid, 0))).toEqual([0, 1])
    expect(committed.grid.cages[cageIdAt(committed.grid, 0)]).toEqual({ op: '+', target: 6 })
    expect(cageIdAt(committed.grid, 5)).toBe(4)
    expect(committed.unreviewedCages).toEqual([0, 4])
    expect(committed.contradictions).toEqual([0])
  })

  it('flags a cage whose clue cell the draft took, keeping its clue on what is left', () => {
    // Cell 4 takes cell 0, where the row's clue is printed.
    const committed = applyDraft(row, grow(startDraft(row.grid, 4), [0]))
    const rest = cageIdAt(committed.grid, 1)
    expect(cageCells(committed.grid, rest)).toEqual([1, 2])
    expect(committed.grid.cages[rest]).toEqual({ op: '+', target: 6 })
    expect(committed.unreviewedCages).toEqual([rest])
  })

  it('retires the flags on the origin, including on the piece it leaves behind', () => {
    const flagged: KenKenPuzzle = { ...row, unreviewedCages: [0], contradictions: [0] }
    // The row drops its last cell, which stays behind as a cage of its own.
    const committed = applyDraft(flagged, grow(startDraft(flagged.grid, 0), [2]))
    expect(cageCells(committed.grid, cageIdAt(committed.grid, 2))).toEqual([2])
    expect(committed.unreviewedCages).toEqual([])
    expect(committed.contradictions).toEqual([])
  })

  it('opens only the clicked piece of a cage a misread split, leaving the other blank', () => {
    // One `+ 5` cage over cells 0 and 2 of the top row, with cell 1 between them its own cage.
    const puzzle = createPuzzle(4)
    puzzle.grid.cageOf[2] = 0
    puzzle.grid.cages[0] = { op: '+', target: 5 }
    const draft = startDraft(puzzle.grid, 2)
    expect([...draft.cells]).toEqual([2])
    expect(draft.cage).toEqual({ op: '+', target: 5 })
    const grown = grow(draft, [6])
    expect(toggleDraftCell(4, grown.cells, 2)).toBeDefined()
    const committed = applyDraft(puzzle, grown)
    expectPartition(committed)
    const drafted = cageIdAt(committed.grid, 2)
    expect(cageCells(committed.grid, drafted)).toEqual([2, 6])
    expect(committed.grid.cages[drafted]).toEqual({ op: '+', target: 5 })
    expect(cageCells(committed.grid, cageIdAt(committed.grid, 0))).toEqual([0])
    expect(committed.grid.cages[cageIdAt(committed.grid, 0)]).toEqual({ op: '=', target: 0 })
  })
})

describe('draftIssue', () => {
  it('refuses a click that would leave the draft in pieces, empty or apart from it', () => {
    const cells = new Set([0, 1, 2])
    expect(draftIssue(4, cells, 1)).toBe('would_split')
    expect(draftIssue(4, cells, 2)).toBeUndefined()
    expect(toggleDraftCell(4, cells, 1)).toBeUndefined()
    expect(draftIssue(4, new Set([0]), 0)).toBe('last_cell')
    expect(toggleDraftCell(4, new Set([0]), 15)).toBeUndefined()
  })
})

describe('isDraftUnchanged', () => {
  it('holds for a draft opened and closed as it was, even after cells went out and back', () => {
    let draft = startDraft(row.grid, 0)
    expect(isDraftUnchanged(row, draft)).toBe(true)
    draft = grow(draft, [2, 2])
    expect(isDraftUnchanged(row, draft)).toBe(true)
  })

  it('fails for a changed shape or clue, or a flagged cage, whose flag the commit clears', () => {
    const draft = startDraft(row.grid, 0)
    expect(isDraftUnchanged(row, grow(draft, [4]))).toBe(false)
    expect(isDraftUnchanged(row, { ...draft, cage: { op: '+', target: 7 } })).toBe(false)
    expect(isDraftUnchanged({ ...row, unreviewedCages: [draft.originCageId] }, draft)).toBe(false)
  })
})
