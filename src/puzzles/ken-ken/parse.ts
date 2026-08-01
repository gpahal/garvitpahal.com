import { z } from 'zod'

import { parseCellName } from '@/lib/grid/geometry'
import { connectedComponents } from '@/lib/grid/regions'
import { pluralize } from '@/lib/x/text'

import { isCageArityValid } from './cage-math'
import { CAGE_OPS, isValidSize, type Cage, type KenKenGrid, type KenKenPuzzle } from './model'

/**
 * The shape the extraction schema already constrains the model to, checked rather than assumed.
 * Only the shape: everything value-dependent - row counts against `n`, names inside this grid,
 * cages agreeing with the layout - is `parseKenKen`'s job.
 */
const cageSchema = z.object({
  clueCell: z.string(),
  op: z.enum(CAGE_OPS),
  target: z.int(),
  cellCount: z.int(),
})

const layoutRowSchema = z.array(z.string())

export const kenKenRawSchema = z.object({
  n: z.int(),
  cellCages: z.array(layoutRowSchema),
  cages: z.array(cageSchema),
  uncertain: z.array(z.string()),
})

export type KenKenRaw = z.infer<typeof kenKenRawSchema>

export type ParseResult = { ok: true; puzzle: KenKenPuzzle } | { ok: false; message: string }

/**
 * Turns the layout into dense cage ids. Coverage needs no repair: the format is `n` rows of `n`
 * entries, so every cell is named exactly once by construction, and the only work is mapping the
 * distinct clue-cell names onto `0..k-1`.
 */
function readLayout(
  n: number,
  cellCages: Array<Array<string>>,
): { cageOf: Uint8Array; anchors: Array<number> } | { message: string } {
  if (cellCages.length !== n) {
    return { message: `Expected ${String(n)} rows, got ${String(cellCages.length)}` }
  }

  const cageOf = new Uint8Array(n * n)
  const idByAnchor = new Map<number, number>()
  const anchors: Array<number> = []

  for (const [row, line] of cellCages.entries()) {
    if (line.length !== n) {
      return {
        message: `Row ${String(row + 1)} has ${String(line.length)} cells, expected ${String(n)}`,
      }
    }
    for (const [col, name] of line.entries()) {
      const anchor = parseCellName(n, name)
      if (anchor === undefined) {
        return { message: `Row ${String(row + 1)} names a cell outside the grid: ${name}` }
      }
      let id = idByAnchor.get(anchor)
      if (id === undefined) {
        id = anchors.length
        idByAnchor.set(anchor, id)
        anchors.push(anchor)
      }
      cageOf[row * n + col] = id
    }
  }

  return { cageOf, anchors }
}

/** Cells of each cage, indexed by cage id. */
function groupCells(cageOf: Uint8Array, cageCount: number): Array<Array<number>> {
  const cells: Array<Array<number>> = Array.from({ length: cageCount }, () => [])
  for (const [cell, id] of cageOf.entries()) {
    cells[id]!.push(cell)
  }
  return cells
}

/**
 * Validates model output into a puzzle.
 *
 * Structurally impossible readings are fatal, because a retry with a stronger model is the right
 * answer and it never reaches the user. Everything else - a cage that disagrees with its own cell
 * count, a clue nailed to the wrong cell, one name used for two separate regions - is kept as read
 * and flagged, because guessing which side of the disagreement is right is exactly how a
 * plausible-but-wrong puzzle gets past the review step.
 */
export function parseKenKen(raw: KenKenRaw): ParseResult {
  const { n } = raw

  if (!isValidSize(n)) {
    return { ok: false, message: `Unsupported grid size: ${String(n)}` }
  }

  const layout = readLayout(n, raw.cellCages)
  if ('message' in layout) {
    return { ok: false, message: layout.message }
  }
  const { cageOf, anchors } = layout

  const clueByAnchor = new Map<number, (typeof raw.cages)[number]>()
  // Two entries naming one clue cell is the model having read the same cage twice and disagreed with
  // itself. Neither reading is more likely right, so the last one is kept and the cage is flagged.
  const duplicated = new Set<number>()
  for (const cage of raw.cages) {
    const anchor = parseCellName(n, cage.clueCell)
    if (anchor !== undefined) {
      if (clueByAnchor.has(anchor)) {
        duplicated.add(anchor)
      }
      clueByAnchor.set(anchor, cage)
    }
  }

  const missing = anchors.filter((anchor) => !clueByAnchor.has(anchor))
  if (missing.length > 0) {
    return {
      ok: false,
      message: `${pluralize(missing.length, 'cage')} ${missing.length === 1 ? 'was' : 'were'} traced but never read`,
    }
  }

  const cells = groupCells(cageOf, anchors.length)
  const cages: Array<Cage> = []
  const unreviewedCages: Array<number> = []
  const flagged = new Set<number>()

  const flag = (cageId: number): void => {
    if (flagged.has(cageId)) {
      return
    }
    flagged.add(cageId)
    unreviewedCages.push(cageId)
  }

  for (const [cageId, anchor] of anchors.entries()) {
    const clue = clueByAnchor.get(anchor)!
    const group = cells[cageId]!
    cages.push({ op: clue.op, target: clue.target })

    if (duplicated.has(anchor)) {
      flag(cageId)
    }
    // The clue is printed in the cage's top-left cell, so the name it was given must be that cell.
    // Cells are row-major, so that is the smallest index in the group.
    if (group[0] !== anchor) {
      flag(cageId)
    }
    // A count the model derived from its own layout disagreeing with the layout means one of the
    // two was mis-transcribed, and there is no way to tell which.
    if (clue.cellCount !== group.length) {
      flag(cageId)
    }
    // One name used for two regions that do not touch: the layout merged two different cages.
    if (connectedComponents(n, group).length > 1) {
      flag(cageId)
    }
    if (!isCageArityValid(clue.op, group.length)) {
      flag(cageId)
    }
    // A bare number is that cell's own value, so it has to be a value this grid actually holds -
    // reading `8` off a 6x6 means the digit was misread. Every other clue is a positive total, so
    // zero or below is always a misread rather than an unusual puzzle.
    if (clue.op === '=' ? clue.target < 1 || clue.target > n : clue.target < 1) {
      flag(cageId)
    }
  }

  for (const name of raw.uncertain) {
    const anchor = parseCellName(n, name)
    const cageId = anchor === undefined ? undefined : anchors.indexOf(anchor)
    if (cageId !== undefined && cageId >= 0) {
      flag(cageId)
    }
  }

  const grid: KenKenGrid = { n, cageOf, cages }
  return { ok: true, puzzle: { grid, unreviewedCages } }
}
