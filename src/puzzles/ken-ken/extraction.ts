import { cellNames } from '@/lib/grid/geometry'

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
 * Targets the failure modes documented for reading irregular regions out of a picture: inventing
 * cage labels and then losing track of them, assuming cages are rectangles, and dropping or
 * double-claiming cells at a border.
 *
 * The layout is asked for as cell names rather than as invented labels because the clue cell is
 * something the model has to find anyway in order to read the clue - so the label is an observation
 * about the image rather than bookkeeping it has to maintain, and it cannot run out of them.
 */
export const KEN_KEN_EXTRACTION_PROMPT = `Read the Ken Ken (Calcudoku, Mathdoku) grid in this image and return it as structured data.

A Ken Ken grid is divided into cages: groups of cells joined edge to edge and enclosed by a heavy
border. Exactly one cell in each cage - always its top-left cell - carries the clue: a target number
with an arithmetic operator.

Cells are named like spreadsheet cells: the column letter counting from the left, then the row
number counting from 1 at the top. A1 is the top-left cell of the grid, B1 is the cell to its right,
A2 is the cell below it.

Rules, in order of importance:

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
   number, and it names itself in "cellCages". That number is the value of that single cell, so it
   is always between 1 and n - if you have read something larger than n, you have either misread the
   digit or missed an operator printed next to it, so look at that cell again. These single-cell
   cages are the puzzle's given values; a grid may have several, or none at all.
7. Subtraction and division are only ever printed on a cage of exactly two cells. If you have written
   "-" or "/" on a cage with any other number of cells, you have mis-traced its border - go back and
   read that part of the picture again.
8. List the clue cell of any cage you are less than fully confident about in "uncertain" - an unclear
   border, a digit you had to guess, an operator you could not make out. It is much better to flag a
   cage than to guess silently. Return an empty array only if you are confident about every cage.

Do not solve the puzzle. Report only what is printed.`
