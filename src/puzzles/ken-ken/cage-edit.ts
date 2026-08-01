import { orthogonalNeighbours } from '@/lib/grid/geometry'
import { compactLabels, connectedComponents } from '@/lib/grid/regions'

import {
  cageCells,
  cageIdAt,
  cloneGrid,
  type Cage,
  type KenKenGrid,
  type KenKenPuzzle,
} from './model'

/**
 * A cage being reshaped. The editor collects one of these while the user clicks cells, then hands it
 * to `applyDraft`; nothing here touches the puzzle until then, so backing out is dropping the draft.
 */
export type CageDraft = {
  /** Cells the cage will hold. Never empty, always orthogonally connected. */
  cells: ReadonlySet<number>
  /** Edited in the same flow. The clue belongs to the cage, so it follows the draft, not a cell. */
  cage: Cage
  /** The cage this started from, retired on commit even if not one of its cells survived. */
  originCageId: number
}

export function startDraft(grid: KenKenGrid, cell: number): CageDraft {
  const originCageId = cageIdAt(grid, cell)
  return {
    cells: new Set(cageCells(grid, originCageId)),
    cage: { ...(grid.cages[originCageId] ?? { op: '=', target: 0 }) },
    originCageId,
  }
}

/** Why a cell cannot be clicked while drafting. `undefined` means it can. */
export type DraftIssue = 'not_adjacent' | 'would_split' | 'last_cell'

/**
 * A draft is only ever one connected, non-empty region, and these are the three ways a click would
 * break that. Nothing about the cell's *current* cage appears here: taking a cell that leaves its
 * old cage in pieces is allowed, and `applyDraft` puts those pieces back together as separate cages.
 * So the only rule a user has to hold in their head is that a cell has to touch the cage.
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
    default: {
      return 'a cage needs at least one cell'
    }
  }
}

/** The new cell set, or `undefined` when the click is one `draftIssue` rejects. */
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

/**
 * Renumbers cages to a gapless range and drops any left empty, carrying `cages` and
 * `unreviewedCages` across so both still point at what they did before.
 */
function compactCages(grid: KenKenGrid, unreviewedCages: Array<number>): KenKenPuzzle {
  const { labels, order } = compactLabels(grid.cageOf)
  const toNew = new Map(order.map((old, next) => [old, next]))

  return {
    grid: {
      n: grid.n,
      cageOf: labels,
      cages: order.map((old) => ({ ...grid.cages[old]! })),
    },
    unreviewedCages: unreviewedCages
      .map((cageId) => toNew.get(cageId))
      .filter((cageId) => cageId !== undefined),
  }
}

/**
 * A cage with no clue yet.
 *
 * The operator is picked from the size rather than defaulting to `=`, which `isCageArityValid` holds
 * to a single cell: a multi-cell fragment born `=` would be flagged "this operator does not fit a
 * cage this size" for an operator the user never chose. `+` fits any size, so the fragment shows a
 * plain `?` and is counted as a missing clue instead - which is the thing that actually needs doing.
 */
function blankCage(cellCount: number): Cage {
  return { op: cellCount === 1 ? '=' : '+', target: 0 }
}

/**
 * Splits `cageId` back into connected pieces after it has lost cells, so no cage is ever left in two
 * places. The piece holding the anchor - the topmost-leftmost cell, where the clue is printed - keeps
 * `cage`; the rest start blank.
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
 * Commits a draft, keeping the grid a valid partition by construction: every cell ends up in exactly
 * one connected cage, whatever the user clicked.
 *
 * Also the editor's live preview, so what is on screen before Done is what Done produces. Pure and
 * cheap enough to re-derive on every render.
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

  for (const donor of donors) {
    // The origin's leftovers start blank because its clue left with the draft, and printing it on
    // both would claim two cages share one answer. A cage that merely lost a cell keeps its clue.
    recomponent(grid, donor, donor === draft.originCageId ? undefined : puzzle.grid.cages[donor])
  }

  return compactCages(grid, retire(puzzle.unreviewedCages, ...donors))
}

/**
 * Drops cages the user has just acted on. `unreviewedCages` records what the model was unsure of,
 * so a deliberate edit answers it; a clue left blank by the edit is surfaced by `findCageIssues`
 * instead, which is about the puzzle as it stands rather than where it came from.
 */
function retire(unreviewedCages: Array<number>, ...cageIds: Array<number>): Array<number> {
  return unreviewedCages.filter((id) => !cageIds.includes(id))
}

/** Setting a clue is the user reviewing that cage, so it stops being flagged. */
export function setCageClue(puzzle: KenKenPuzzle, cageId: number, cage: Cage): KenKenPuzzle {
  const grid = cloneGrid(puzzle.grid)
  grid.cages[cageId] = { ...cage }
  return { grid, unreviewedCages: retire(puzzle.unreviewedCages, cageId) }
}
