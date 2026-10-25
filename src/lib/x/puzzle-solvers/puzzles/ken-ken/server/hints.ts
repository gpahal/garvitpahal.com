import { z } from 'zod'

import { cellName, orthogonalNeighbours, parseCellName } from '../../../grid/geometry'
import { connectedComponents } from '../../../grid/regions'
import type { HintsShape } from '../../../vision/server/extract-handler'
import { formatMeasuredHints } from '../../../vision/server/prompt-text'
import type { KenKenHints } from '../api'
import { KEN_KEN_SIZES } from '../model'

const heavyEdgeSchema = z.strictObject({
  a: z.string().max(3),
  b: z.string().max(3),
})

/**
 * The prompt builder skips a name outside the grid, so a hint naming one describes another grid,
 * and an edge between cells that do not touch describes none.
 */
function isWithinGrid({ n, heavyEdges, unreadCells }: KenKenHints): boolean {
  if (n === undefined) {
    return true
  }
  const isEdge = ({ a, b }: { a: string; b: string }): boolean => {
    const from = parseCellName(n, a)
    const to = parseCellName(n, b)
    return from !== undefined && to !== undefined && orthogonalNeighbours(n, from).includes(to)
  }
  return (
    (heavyEdges ?? []).every(isEdge) &&
    (unreadCells ?? []).every((name) => parseCellName(n, name) !== undefined)
  )
}

export const kenKenHintsSchema: z.ZodType<KenKenHints> = z
  .strictObject({
    n: z.literal([...KEN_KEN_SIZES.list]).optional(),
    heavyEdges: z
      .array(heavyEdgeSchema)
      .max(2 * KEN_KEN_SIZES.max * (KEN_KEN_SIZES.max - 1))
      .optional(),
    unreadCells: z
      .array(z.string().max(3))
      .max(KEN_KEN_SIZES.max * KEN_KEN_SIZES.max)
      .optional(),
  } satisfies HintsShape<KenKenHints>)
  .refine(isWithinGrid, 'Hints must describe the grid they name')

function edgeKey(a: number, b: number): string {
  return `${String(Math.min(a, b))}-${String(Math.max(a, b))}`
}

function parsedCells(n: number, names: Array<string>): Array<number> {
  return names.map((name) => parseCellName(n, name)).filter((cell) => cell !== undefined)
}

function unreadNeighbours(n: number, group: Array<number>, unread: Set<number>): Set<number> {
  return new Set(
    group.flatMap((cell) =>
      orthogonalNeighbours(n, cell).filter((neighbour) => unread.has(neighbour)),
    ),
  )
}

/**
 * Cells whose borders could not be measured are left out, and a group touching one is reported as
 * possibly extending into it.
 */
function describeLayout(n: number, hints: KenKenHints): Array<string> {
  if (hints.heavyEdges === undefined) {
    return []
  }
  const unread = new Set(parsedCells(n, hints.unreadCells ?? []))
  const heavy = new Set<string>()
  for (const edge of hints.heavyEdges) {
    const a = parseCellName(n, edge.a)
    const b = parseCellName(n, edge.b)
    if (a !== undefined && b !== undefined) {
      heavy.add(edgeKey(a, b))
    }
  }
  const readable: Array<number> = []
  for (let cell = 0; cell < n * n; cell++) {
    if (!unread.has(cell)) {
      readable.push(cell)
    }
  }
  const groups = connectedComponents(n, readable, (a, b) => !heavy.has(edgeKey(a, b)))

  const lines: Array<string> = []
  const complete: Array<string> = []
  for (const group of groups) {
    const names = group.map((cell) => cellName(n, cell)).join(', ')
    const touching = unreadNeighbours(n, group, unread)
    if (touching.size === 0) {
      complete.push(`{${names}}`)
    } else {
      lines.push(
        `${group.length === 1 ? `Cell ${names} is` : `Cells ${names} are`} in one cage, which may also include ${[
          ...touching,
        ]
          .map((cell) => cellName(n, cell))
          .join(', ')}.`,
      )
    }
  }
  if (complete.length > 0) {
    lines.unshift(`The heavy borders enclose these cages: ${complete.join(' ')}.`)
  }
  if (unread.size > 0) {
    lines.push(
      `The borders of ${[...unread].map((cell) => cellName(n, cell)).join(', ')} could not be ` +
        'measured, so trace that part of the grid from the picture.',
    )
  }
  return lines
}

export function describeHints(hints: KenKenHints): string {
  const lines =
    hints.n === undefined
      ? []
      : [`The grid is ${String(hints.n)}x${String(hints.n)}.`, ...describeLayout(hints.n, hints)]
  return formatMeasuredHints(lines)
}
