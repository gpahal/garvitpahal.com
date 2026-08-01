import { EMPTY, MAX_SUDOKU_SIZE, SUDOKU_SIZES } from './model'

/**
 * Every legal cell value: `EMPTY` (0) plus 1..16. Expressed as an enum because the structured-output
 * subset has no `minimum`/`maximum`, and because an integer domain removes the blank-symbol drift
 * that a string encoding invites.
 */
const CELL_VALUES = Array.from({ length: MAX_SUDOKU_SIZE + 1 }, (_, value) => value + EMPTY)

/**
 * Server-only. Imported by the sudoku endpoint and nothing else, so the prompt never ships to the
 * browser.
 *
 * The schema stays inside the provider's structured-output subset: every object needs
 * `additionalProperties: false` and `required`, and `minimum`/`maxItems`/`minLength` are not
 * supported. Size constraints are expressed as `enum`; array lengths are checked in `parse`.
 */
export const SUDOKU_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    n: {
      type: 'integer',
      enum: [...SUDOKU_SIZES],
      description: 'Grid width and height in cells.',
    },
    boxWidth: {
      type: 'integer',
      enum: [2, 3, 4],
      description: 'Width of one box (the sub-region bounded by thick lines), in cells.',
    },
    boxHeight: {
      type: 'integer',
      enum: [2, 3, 4],
      description: 'Height of one box, in cells.',
    },
    cells: {
      type: 'array',
      description: 'Rows, top to bottom. Each row is left to right. Exactly n rows of n entries.',
      items: {
        type: 'array',
        items: {
          type: 'integer',
          enum: [...CELL_VALUES],
          description: 'The printed value, or 0 for an empty cell.',
        },
      },
    },
    uncertain: {
      type: 'array',
      description: 'Cells you are not fully confident about. Empty array if none.',
      items: {
        type: 'object',
        properties: {
          row: { type: 'integer', description: '0-based row index.' },
          col: { type: 'integer', description: '0-based column index.' },
        },
        required: ['row', 'col'],
        additionalProperties: false,
      },
    },
  },
  required: ['n', 'boxWidth', 'boxHeight', 'cells', 'uncertain'],
  additionalProperties: false,
} as const

/**
 * Targets the failure modes documented for grid extraction: drifting to a different blank symbol,
 * assuming box geometry instead of reading it, and off-by-one row alignment.
 */
export const SUDOKU_EXTRACTION_PROMPT = `Read the Sudoku grid in this image and return it as structured data.

Rules, in order of importance:

1. Every cell is an integer. Use 0 for an empty cell and the printed value (1 to n) for a filled
   one. Never use a string, null, or any placeholder character.
2. Determine the grid size n by counting cells along one edge. Common sizes are 4, 6, 8, 9, 12 and 16.
3. Determine box geometry by looking at the THICK dividing lines, not by assuming. A 6x6 grid may
   have boxes that are 3 wide and 2 tall, or 2 wide and 3 tall — these are different puzzles, so
   read the lines carefully. boxWidth * boxHeight must equal n.
4. Output "cells" as exactly n rows, each with exactly n entries, top-to-bottom and left-to-right.
   Work one row at a time and re-check the row index against the image before moving on; an
   off-by-one row shift silently corrupts the whole grid.
5. Grids larger than 9 often print values above 9 as letters. Convert them to integers: A is 10,
   B is 11, and so on up to G for 16. Return the integer, never the letter.
6. List any cell you are less than fully confident about in "uncertain" — a smudged digit, a glare
   spot, an ambiguous 1 vs 7, or anything you had to guess. It is much better to flag a cell than to
   guess silently. Return an empty array only if you are confident about every cell.

Do not solve the puzzle. Report only what is printed.`
