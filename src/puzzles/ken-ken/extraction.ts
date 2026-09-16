import { cellName, cellNames, orthogonalNeighbours, parseCellName } from '@/lib/grid/geometry'
import { connectedComponents } from '@/lib/grid/regions'

import type { KenKenHints } from './hints'
import { CAGE_OPS, KEN_KEN_SIZES, MAX_KEN_KEN_SIZE } from './model'

/**
 * Every cell name of the largest grid we accept, `A1` to `H8`. Pinning the schema to this enum means
 * a malformed or out-of-grid cell is unrepresentable rather than merely invalid: structured output
 * rejects it before the parser ever sees it. A smaller grid uses a prefix of these, which `parse`
 * checks against the reported `n`.
 */
const CELL_NAMES = cellNames(MAX_KEN_KEN_SIZE)

const cellNameSchema = {
  type: 'string',
  enum: CELL_NAMES,
} as const

/**
 * Server-only. Imported by the Ken Ken endpoint and nothing else, so the prompt never ships to the
 * browser.
 *
 * The schema stays inside the provider's structured-output subset: every object needs
 * `additionalProperties: false` and `required`, and `minItems`/`maxItems`/`minimum` are not
 * supported. Array lengths are checked in `parse`.
 */
export const KEN_KEN_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    n: {
      type: 'integer',
      enum: [...KEN_KEN_SIZES],
      description: 'Grid width and height in cells.',
    },
    cellCages: {
      type: 'array',
      description:
        'The cage layout. Exactly n rows, top to bottom; each row exactly n entries, left to ' +
        "right. Each entry is the name of the cell where that cell's cage prints its clue.",
      items: {
        type: 'array',
        items: cellNameSchema,
      },
    },
    cages: {
      type: 'array',
      description: 'One entry per distinct cell name used in cellCages.',
      items: {
        type: 'object',
        properties: {
          clueCell: {
            ...cellNameSchema,
            description: 'The cell this cage prints its clue in - the cage top-left cell.',
          },
          op: {
            type: 'string',
            enum: [...CAGE_OPS],
            description:
              "The printed operator. Use '=' for a single-cell cage, which prints a bare number " +
              'and no operator at all.',
          },
          target: {
            type: 'integer',
            description:
              "The number printed in the cage, without the operator. For '=' this is the cell's " +
              'own value, so it is between 1 and n.',
          },
          cellCount: {
            type: 'integer',
            description: 'How many cells this cage covers. Count them in cellCages.',
          },
        },
        required: ['clueCell', 'op', 'target', 'cellCount'],
        additionalProperties: false,
      },
    },
    uncertain: {
      type: 'array',
      description: 'Clue cells of cages you are not fully confident about. Empty array if none.',
      items: cellNameSchema,
    },
  },
  required: ['n', 'cellCages', 'cages', 'uncertain'],
  additionalProperties: false,
} as const

/**
 * The cage layout the measured heavy edges imply, as groups of cells. Cells whose borders could
 * not be measured are left out, and any group touching one of them is reported as possibly
 * extending into it: the group as listed is right, but it may not be the whole cage.
 */
function describeLayout(n: number, hints: KenKenHints): Array<string> {
  if (hints.heavyEdges === undefined) {
    return []
  }
  const unread = new Set<number>()
  const unreadNames = hints.unreadCells ?? []
  for (const name of unreadNames) {
    const cell = parseCellName(n, name)
    if (cell !== undefined) {
      unread.add(cell)
    }
  }
  const heavy = new Set<string>()
  for (const edge of hints.heavyEdges) {
    const a = parseCellName(n, edge.a)
    const b = parseCellName(n, edge.b)
    if (a !== undefined && b !== undefined) {
      heavy.add(`${String(Math.min(a, b))}-${String(Math.max(a, b))}`)
    }
  }
  const readable: Array<number> = []
  for (let cell = 0; cell < n * n; cell++) {
    if (!unread.has(cell)) {
      readable.push(cell)
    }
  }
  const groups = connectedComponents(
    n,
    readable,
    (a, b) => !heavy.has(`${String(Math.min(a, b))}-${String(Math.max(a, b))}`),
  )

  const lines: Array<string> = []
  const complete: Array<string> = []
  for (const group of groups) {
    const names = group.map((cell) => cellName(n, cell)).join(', ')
    const touching = new Set<number>()
    for (const cell of group) {
      for (const neighbour of orthogonalNeighbours(n, cell)) {
        if (unread.has(neighbour)) {
          touching.add(neighbour)
        }
      }
    }
    if (touching.size === 0) {
      complete.push(`{${names}}`)
    } else {
      lines.push(
        `Cells ${names} are in one cage, which may also include ${[...touching]
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

/**
 * What the browser measured, phrased as observations to check rather than facts to assume: a
 * wrong hint is worse than none, so the gate on the browser side is strict and the wording here
 * leaves the model free to disagree with the picture in front of it.
 */
function describeHints(hints: KenKenHints): string {
  const lines: Array<string> = []
  if (hints.n !== undefined) {
    lines.push(
      `The grid is ${String(hints.n)}x${String(hints.n)}.`,
      ...describeLayout(hints.n, hints),
    )
  }
  if (lines.length === 0) {
    return ''
  }
  return (
    'Measured from the picture before it was sent, so check each against the image and trust ' +
    `the image if they disagree:\n\n${lines.map((line) => `- ${line}`).join('\n')}\n\n`
  )
}

/**
 * Targets the failure modes documented for reading irregular regions out of a picture: inventing
 * cage labels and then losing track of them, assuming cages are rectangles, and dropping or
 * double-claiming cells at a border. Rules 6 and 7 name the two misreads the bench saw most: a
 * vertical run cut one cell short, and a single-cell cage swallowed by the cell below it.
 *
 * The layout is asked for as cell names rather than as invented labels because the clue cell is
 * something the model has to find anyway in order to read the clue - so the label is an observation
 * about the image rather than bookkeeping it has to maintain, and it cannot run out of them.
 */
export function kenKenExtractionPrompt(hints: KenKenHints): string {
  return `Read the Ken Ken (Calcudoku, Mathdoku) grid in this image and return it as structured data.

A Ken Ken grid is divided into cages: groups of cells joined edge to edge and enclosed by a heavy
border. Exactly one cell in each cage - always its top-left cell - carries the clue: a target number
with an arithmetic operator.

Cells are named like spreadsheet cells: the column letter counting from the left, then the row
number counting from 1 at the top. A1 is the top-left cell of the grid, B1 is the cell to its right,
A2 is the cell below it.

${describeHints(hints)}Rules, in order of importance:

1. Determine the grid size n by counting cells along one edge. It is 4, 5, 6, 7 or 8.
2. Fill "cellCages" with the cage layout. Work along row 1 from the left, then row 2, and so on. For
   every cell, write the name of the cell where that cell's cage prints its clue. All the cells
   inside one heavy border therefore carry the same name, and that name is the cage's top-left cell.
   Output exactly n rows of exactly n entries. Do not skip a cell and do not list one twice.
3. Trace each cage by following its heavy border. Cage borders are drawn thicker and brighter than
   the thin lines that separate cells inside the same cage. Cages are often not rectangles - an L,
   a T, an S, a straight run of three, and a lone single cell are all normal shapes. Never assume a
   rectangle, and never assume two cages are the same shape.
4. Add one "cages" entry for every distinct name that appears in "cellCages", and no others. Set
   "cellCount" by counting how many times that name appears in the "cellCages" you just wrote.
5. Read the operator as printed and report it as "+", "-", "*" or "/". It may be drawn as x or × for
   multiplication and ÷ for division. The operator may be printed before the number or after it -
   "×20" and "20×" mean exactly the same cage. Put the bare number in "target" and never include the
   operator in it.
6. A cell showing a bare number and no operator at all is a cage of one cell: op "=", target that
   number, and it names itself in "cellCages". Such a cell is enclosed by heavy lines on all four
   sides - if the line below it is thin, it is not a single-cell cage and the number is a clue for
   the cells beneath. That number is the value of that single cell, so it is always between 1 and
   n - if you have read something larger than n, you have either misread the digit or missed an
   operator printed next to it, so look at that cell again. These single-cell cages are the puzzle's
   given values; a grid may have several, or none at all.
7. When a cage runs down a column, keep going past each cell until the line below the last cell you
   have counted is a heavy one; a thin line means the cage continues. Stopping one cell short is the
   most common mistake, so check the line at the bottom of every vertical run before moving on.
8. Subtraction and division are only ever printed on a cage of exactly two cells. If you have written
   "-" or "/" on a cage with any other number of cells, you have mis-traced its border - go back and
   read that part of the picture again.
9. List the clue cell of any cage you are less than fully confident about in "uncertain" - an unclear
   border, a digit you had to guess, an operator you could not make out. It is much better to flag a
   cage than to guess silently. Return an empty array only if you are confident about every cage.

Do not solve the puzzle. Report only what is printed.`
}
