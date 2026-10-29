import { z } from 'zod'

import { pluralize } from '@/lib/text'

import { cellNames, indexOf, parseCellName, squareRowsError } from '../../../grid/geometry'
import { cellsByLabel, compactLabels } from '../../../grid/regions'
import type { ParseResult } from '../../types'
import { CAGE_OPS, KEN_KEN_SIZES } from '../model'
import type { Cage, KenKenGrid, KenKenPuzzle } from '../model'
import { cageIssue } from '../validate'

const cellNameSchema = z.enum(cellNames(KEN_KEN_SIZES.max))

const cageSchema = z.strictObject({
  clueCell: cellNameSchema.describe(
    "The cell this cage prints its clue in: the leftmost cell of the cage's top row.",
  ),
  op: z
    .enum(CAGE_OPS)
    .describe(
      "The printed operator. Use '=' for a single-cell cage, which prints a bare number " +
        'and no operator at all.',
    ),
  target: z
    .int()
    .describe(
      "The number printed in the cage, without the operator. For '=' this is the cell's " +
        'own value, so it is between 1 and n.',
    ),
  cellCount: z.int().describe('How many cells this cage covers. Count them in cellCages.'),
})

const layoutRowSchema = z.array(cellNameSchema)

/**
 * The descriptions are prompt text. Anything value-dependent, such as row counts against `n`, is
 * `parseKenKen`'s job, since array lengths are outside the structured-output subset.
 */
export const kenKenRawSchema = z.strictObject({
  n: z.literal([...KEN_KEN_SIZES.list]).describe('Grid width and height in cells.'),
  cellCages: z
    .array(layoutRowSchema)
    .describe(
      'The cage layout. Exactly n rows, top to bottom; each row exactly n entries, left to ' +
        "right. Each entry is the name of the cell where that cell's cage prints its clue.",
    ),
  cages: z.array(cageSchema).describe('One entry per distinct cell name used in cellCages.'),
  uncertain: z
    .array(cellNameSchema)
    .describe('Clue cells of cages you are not fully confident about. Empty array if none.'),
})

export type KenKenRaw = z.infer<typeof kenKenRawSchema>

/**
 * Each cell names its cage's clue cell. Compaction numbers the distinct names `0..k-1` in reading
 * order.
 */
function readLayout(
  n: number,
  cellCages: Array<Array<string>>,
): { cageOf: Uint8Array; anchors: Array<number> } | { message: string } {
  const shapeError = squareRowsError(n, cellCages)
  if (shapeError !== undefined) {
    return { message: shapeError }
  }

  // A cell index fits a byte: the largest grid is 8x8.
  const anchorOf = new Uint8Array(n * n)
  for (const [row, line] of cellCages.entries()) {
    for (const [col, name] of line.entries()) {
      const anchor = parseCellName(n, name)
      if (anchor === undefined) {
        return { message: `Row ${String(row + 1)} names a cell outside the grid: ${name}` }
      }
      anchorOf[indexOf(n, row, col)] = anchor
    }
  }

  const { labels: cageOf, order: anchors } = compactLabels(anchorOf)
  return { cageOf, anchors }
}

/**
 * Structurally impossible readings are fatal. Any other disagreement is kept as read and flagged as
 * a contradiction, since guessing which side is right is how a plausible but wrong puzzle gets past
 * review. The model's `uncertain` list is only flagged for review: a hedge, not evidence. Every
 * contradiction is also unreviewed.
 */
export function parseKenKen(raw: KenKenRaw): ParseResult<KenKenPuzzle> {
  const { n } = raw

  const layout = readLayout(n, raw.cellCages)
  if ('message' in layout) {
    return { ok: false, message: layout.message }
  }
  const { cageOf, anchors } = layout

  const anchorCells = new Set(anchors)
  const clueByAnchor = new Map<number, (typeof raw.cages)[number]>()
  // The model read one cage twice and disagreed with itself. Neither reading is likelier, so the
  // last is kept and the cage flagged.
  const duplicated = new Set<number>()
  // A clue read for a cell the layout puts inside another cage means that cage swallowed the
  // clue's own: two cages traced as one.
  const swallowing = new Set<number>()
  for (const cage of raw.cages) {
    const cell = parseCellName(n, cage.clueCell)
    if (cell === undefined) {
      continue
    }
    if (!anchorCells.has(cell)) {
      swallowing.add(cageOf[cell] ?? 0)
      continue
    }

    if (clueByAnchor.has(cell)) {
      duplicated.add(cell)
    }
    clueByAnchor.set(cell, cage)
  }

  const read = anchors.flatMap((anchor) => {
    const clue = clueByAnchor.get(anchor)
    return clue === undefined ? [] : { anchor, clue }
  })
  const missing = anchors.length - read.length
  if (missing > 0) {
    return {
      ok: false,
      message: `${pluralize(missing, 'cage')} ${missing === 1 ? 'was' : 'were'} traced but never read`,
    }
  }

  const cells = cellsByLabel(cageOf, anchors.length)
  const cages: Array<Cage> = read.map(({ clue }) => ({ op: clue.op, target: clue.target }))
  const grid: KenKenGrid = { n, cageOf, cages }
  // With no clue missing, `read` is in cage order.
  const contradictions = read.flatMap(({ anchor, clue }, cageId) => {
    const group = cells[cageId] ?? []
    const isContradicted =
      duplicated.has(anchor) ||
      swallowing.has(cageId) ||
      // The clue is printed in the leftmost cell of the top row, the group's smallest index.
      group[0] !== anchor ||
      // One of the count and the layout was mis-transcribed, and there is no telling which.
      clue.cellCount !== group.length ||
      // The editor's own rules, so a read is never stricter or laxer than what the user may type.
      cageIssue(grid, cageId, group) !== undefined
    return isContradicted ? cageId : []
  })

  // Any cell names its cage, so a doubt about the wrong cell of a cage still flags it.
  const unreviewedCages = [...contradictions]
  for (const name of raw.uncertain) {
    const cell = parseCellName(n, name)
    const cageId = cell === undefined ? undefined : cageOf[cell]
    if (cageId !== undefined && !unreviewedCages.includes(cageId)) {
      unreviewedCages.push(cageId)
    }
  }

  return { ok: true, puzzle: { grid, unreviewedCages, contradictions } }
}
