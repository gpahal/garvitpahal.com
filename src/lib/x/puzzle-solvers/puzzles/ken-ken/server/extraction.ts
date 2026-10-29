import { createExtractHandler } from '../../../vision/server/extract-handler'
import type { VisionModels } from '../../../vision/server/models'
import { CELL_NAMING, formatSizeChoices, PROMPT_CLOSING } from '../../../vision/server/prompt-text'
import { puzzleToWire } from '../api'
import type { KenKenHints, KenKenPuzzleWire } from '../api'
import { KEN_KEN_SIZES } from '../model'
import type { KenKenPuzzle } from '../model'
import { describeHints, kenKenHintsSchema } from './hints'
import { kenKenRawSchema, parseKenKen } from './parse'
import type { KenKenRaw } from './parse'

/**
 * Cages are named by their clue cell, since a model loses track of invented labels.
 */
export function kenKenExtractionPrompt(hints: KenKenHints): string {
  return `Read the Ken Ken (Calcudoku, Mathdoku) grid in this image and return it as structured data.
Every clue is printed inside a cell, so ignore anything outside the grid's heavy outer border.

A Ken Ken grid is divided into cages: groups of cells joined edge to edge and enclosed by a heavy
border. Exactly one cell in each cage carries the clue: a target number with an arithmetic operator.
It is always the leftmost cell of the cage's top row.

${CELL_NAMING}

${describeHints(hints)}Rules, in order of importance:

1. Determine the grid size n by counting cells along one edge. It is ${formatSizeChoices(KEN_KEN_SIZES.list)}.
2. Fill "cellCages" with the cage layout. Work along row 1 from the left, then row 2, and so on. For
   every cell, write the name of the cell where that cell's cage prints its clue. All the cells
   inside one heavy border therefore carry the same name, and that name is the leftmost cell of the
   cage's top row. Output exactly n rows of exactly n entries. Do not skip a cell and do not list
   one twice.
3. Trace each cage by following its heavy border. Cage borders are drawn thicker and bolder than
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

${PROMPT_CLOSING}`
}

const KEN_KEN_VISION_MODELS: VisionModels = {
  initial: [
    { id: 'gpt-6-sol', effort: 'none' },
    { id: 'gpt-6-sol', effort: 'medium', tier: 'fast' },
  ],
  fallback: [{ id: 'gpt-6-sol', effort: 'xhigh', tier: 'fast' }],
}

export const kenKenExtraction = createExtractHandler<
  KenKenRaw,
  KenKenPuzzle,
  KenKenPuzzleWire,
  KenKenHints
>({
  models: KEN_KEN_VISION_MODELS,
  hintsSchema: kenKenHintsSchema,
  prompt: kenKenExtractionPrompt,
  responseSchema: kenKenRawSchema,
  parse: parseKenKen,
  toWire: puzzleToWire,
  logFields: ({ grid, contradictions, unreviewedCages }) => ({
    n: grid.n,
    cageCount: grid.cages.length,
    contradictions: contradictions.length,
    unreviewedCount: unreviewedCages.length,
  }),
})
