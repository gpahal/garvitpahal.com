import { orthogonalNeighbours } from '../../grid/geometry'
import { compactLabels, connectedComponents } from '../../grid/regions'
import { isCageArityValid } from './cage-math'
import { cageCells, cageIdAt, cellsByCage, cloneGrid } from './model'
import type { Cage, KenKenGrid, KenKenPuzzle } from './model'

/**
 * Nothing touches the puzzle until `applyDraft`, so backing out is dropping the draft.
 */
export type CageDraft = {
  /**
   * Never empty, always orthogonally connected.
   */
  cells: ReadonlySet<number>
  cage: Cage
  /**
   * Committing answers its flags and leaves its cells outside the draft without a clue, even when
   * the draft keeps none of its cells.
   */
  originCageId: number
}

/**
 * Opens only the piece of the cage holding `cell`: a misread can leave a cage in two pieces, and a
 * draft holding both could never lose a cell without `would_split`.
 */
export function startDraft(grid: KenKenGrid, cell: number): CageDraft {
  const originCageId = cageIdAt(grid, cell)
  const pieces = connectedComponents(grid.n, cageCells(grid, originCageId))
  return {
    cells: new Set(pieces.find((piece) => piece.includes(cell)) ?? [cell]),
    cage: { ...(grid.cages[originCageId] ?? { op: '=', target: 0 }) },
    originCageId,
  }
}

type DraftIssue = 'not_adjacent' | 'would_split' | 'last_cell'

/**
 * A cell's current cage does not matter: `applyDraft` splits whatever it leaves behind into separate
 * cages.
 */
export function draftIssue(
  n: number,
  cells: ReadonlySet<number>,
  cell: number,
): DraftIssue | undefined {
  if (!cells.has(cell)) {
    return orthogonalNeighbours(n, cell).some((neighbour) => cells.has(neighbour))
      ? undefined
      : 'not_adjacent'
  }
  if (cells.size === 1) {
    return 'last_cell'
  }

  const remaining = [...cells].filter((member) => member !== cell)
  return connectedComponents(n, remaining).length > 1 ? 'would_split' : undefined
}

export function describeDraftIssue(issue: DraftIssue): string {
  switch (issue) {
    case 'not_adjacent': {
      return 'not next to this cage'
    }
    case 'would_split': {
      return 'removing it would leave this cage in two pieces'
    }
    case 'last_cell': {
      return 'a cage needs at least one cell'
    }
  }
}

export function toggleDraftCell(
  n: number,
  cells: ReadonlySet<number>,
  cell: number,
): Set<number> | undefined {
  if (draftIssue(n, cells, cell)) {
    return undefined
  }

  const next = new Set(cells)
  if (!next.delete(cell)) {
    next.add(cell)
  }
  return next
}

function compactCages(
  grid: KenKenGrid,
  unreviewedCages: Array<number>,
  contradictions: Array<number>,
): KenKenPuzzle {
  const { labels, order } = compactLabels(grid.cageOf)
  const toNew = new Map(order.map((old, next) => [old, next]))
  const renumber = (cageIds: Array<number>): Array<number> =>
    cageIds.map((cageId) => toNew.get(cageId)).filter((cageId) => cageId !== undefined)

  return {
    grid: {
      n: grid.n,
      cageOf: labels,
      cages: order.flatMap((old) => {
        const cage = grid.cages[old]
        return cage === undefined ? [] : { ...cage }
      }),
    },
    unreviewedCages: renumber(unreviewedCages),
    contradictions: renumber(contradictions),
  }
}

/**
 * Multi-cell cages start as `+`, which fits any size, so a fragment is reported as missing its clue
 * rather than as having an operator the user never chose.
 */
function blankCage(cellCount: number): Cage {
  return { op: cellCount === 1 ? '=' : '+', target: 0 }
}

export function withDraftCells(draft: CageDraft, cells: ReadonlySet<number>): CageDraft {
  const isUnsetAndUnfit = draft.cage.target === 0 && !isCageArityValid(draft.cage.op, cells.size)
  return { ...draft, cells, cage: isUnsetAndUnfit ? blankCage(cells.size) : draft.cage }
}

/**
 * The piece holding the clue cell keeps `cage`; the rest start blank.
 */
function recomponent(grid: KenKenGrid, cageId: number, cage: Cage | undefined): void {
  const components = connectedComponents(grid.n, cageCells(grid, cageId))
  const [anchorComponent, ...fragments] = components
  if (!anchorComponent) {
    return
  }

  grid.cages[cageId] = cage ? { ...cage } : blankCage(anchorComponent.length)
  for (const fragment of fragments) {
    const id = grid.cages.length
    grid.cages.push(blankCage(fragment.length))
    for (const member of fragment) {
      grid.cageOf[member] = id
    }
  }
}

/**
 * Leaves every cell in exactly one connected cage whatever was clicked. Cheap enough for the
 * editor's live preview on every render.
 */
export function applyDraft(puzzle: KenKenPuzzle, draft: CageDraft): KenKenPuzzle {
  const grid = cloneGrid(puzzle.grid)

  const donors = new Set<number>([draft.originCageId])
  for (const cell of draft.cells) {
    donors.add(cageIdAt(grid, cell))
  }

  const draftId = grid.cages.length
  grid.cages.push({ ...draft.cage })
  for (const cell of draft.cells) {
    grid.cageOf[cell] = draftId
  }

  // Only the origin's flags are answered. A cage the draft took whole is dropped with its flags by
  // compaction.
  const unreviewedCages = retire(puzzle.unreviewedCages, draft.originCageId)
  const cellsBefore = cellsByCage(puzzle.grid)
  for (const donor of donors) {
    const isOrigin = donor === draft.originCageId
    // Other donors keep their clue, flagged when the draft took the cell it was printed in.
    recomponent(grid, donor, isOrigin ? undefined : puzzle.grid.cages[donor])
    const clueCell = cellsBefore[donor]?.[0]
    const tookClueCell = clueCell !== undefined && draft.cells.has(clueCell)
    if (!isOrigin && tookClueCell && !unreviewedCages.includes(donor)) unreviewedCages.push(donor)
  }

  return compactCages(grid, unreviewedCages, retire(puzzle.contradictions, draft.originCageId))
}

/**
 * Also false when the commit would clear a flag.
 */
export function isDraftUnchanged(puzzle: KenKenPuzzle, draft: CageDraft): boolean {
  const { originCageId: id, cells, cage } = draft
  const origin = puzzle.grid.cages[id]
  const originCells = cageCells(puzzle.grid, id)
  return (
    origin?.op === cage.op &&
    origin.target === cage.target &&
    originCells.length === cells.size &&
    originCells.every((cell) => cells.has(cell)) &&
    // A contradiction is always unreviewed too (`KenKenPuzzle`).
    !puzzle.unreviewedCages.includes(id)
  )
}

function retire(flags: Array<number>, cageId: number): Array<number> {
  return flags.filter((id) => id !== cageId)
}

export function setCageClue(puzzle: KenKenPuzzle, cageId: number, cage: Cage): KenKenPuzzle {
  const grid = cloneGrid(puzzle.grid)
  grid.cages[cageId] = { ...cage }
  return {
    grid,
    unreviewedCages: retire(puzzle.unreviewedCages, cageId),
    contradictions: retire(puzzle.contradictions, cageId),
  }
}
