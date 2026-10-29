import { createExtractHandler } from '../../../vision/server/extract-handler'
import type { VisionModels } from '../../../vision/server/models'
import { CELL_NAMING, formatSizeChoices, PROMPT_CLOSING } from '../../../vision/server/prompt-text'
import { puzzleToWire } from '../api'
import type { SudokuHints, SudokuPuzzleWire } from '../api'
import { SUDOKU_SIZES } from '../model'
import { describeHints, sudokuHintsSchema } from './hints'
import { parseSudoku, sudokuRawSchema } from './parse'
import type { ParsedSudoku, SudokuRaw } from './parse'

export function sudokuExtractionPrompt(hints: SudokuHints): string {
  return `Read the Sudoku grid in this image and return it as structured data.

${CELL_NAMING}

${describeHints(hints)}Rules, in order of importance:

1. Every cell is an integer. Use 0 for an empty cell and the printed value (1 to n) for a filled
   one. Never use a string, null, or any placeholder character.
2. Determine the grid size n by counting cells along one edge. It is ${formatSizeChoices(SUDOKU_SIZES.list)}.
3. Determine box geometry by looking at the THICK dividing lines, not by assuming. A 6x6 grid may
   have boxes that are 3 wide and 2 tall, or 2 wide and 3 tall - these are different puzzles, so
   read the lines carefully. boxWidth * boxHeight must equal n.
4. Output "cells" as exactly n rows, each with exactly n entries, top-to-bottom and left-to-right.
   Work one row at a time and re-check the row index against the image before moving on; an
   off-by-one row shift silently corrupts the whole grid. Small pencil marks in a corner of a cell
   are notes, not the cell's value: such a cell is empty.
5. Grids larger than 9 often print values above 9 as letters. Convert them to integers: A is 10,
   B is 11, and so on up to G for 16. Return the integer, never the letter. Some 16x16 grids print
   0 to F instead of 1 to G: in those a printed 0 is a value, not an empty cell, so return it as 16,
   and A to F are still 10 to 15.
6. List the name of any cell you are less than fully confident about in "uncertain" - a smudged
   digit, a glare spot, an ambiguous 1 vs 7, or anything you had to guess. It is much better to flag
   a cell than to guess silently. Return an empty array only if you are confident about every cell.

${PROMPT_CLOSING}`
}

const SUDOKU_VISION_MODELS: VisionModels = {
  initial: [
    { id: 'gpt-6-luna', effort: 'none' },
    { id: 'gpt-6-sol', effort: 'low' },
  ],
  fallback: [{ id: 'gpt-6-sol', effort: 'high', tier: 'fast' }],
}

export const sudokuExtraction = createExtractHandler<
  SudokuRaw,
  ParsedSudoku,
  SudokuPuzzleWire,
  SudokuHints
>({
  models: SUDOKU_VISION_MODELS,
  hintsSchema: sudokuHintsSchema,
  prompt: sudokuExtractionPrompt,
  responseSchema: sudokuRawSchema,
  parse: parseSudoku,
  toWire: puzzleToWire,
  logFields: ({ grid, uncertain, unusableBoxes }) => ({
    n: grid.n,
    givens: grid.values.filter((value) => value !== 0).length,
    uncertainCount: uncertain.length,
    ...(unusableBoxes && {
      unusableBoxes: `${String(unusableBoxes.boxWidth)}x${String(unusableBoxes.boxHeight)}`,
    }),
  }),
})
