import { createExtractHandler } from '@/lib/vision/extract-endpoint'
import { puzzleToWire, SUDOKU_MAX_IMAGE_BYTES, type SudokuPuzzleWire } from '@/puzzles/sudoku/api'
import { SUDOKU_EXTRACTION_SCHEMA, sudokuExtractionPrompt } from '@/puzzles/sudoku/extraction'
import { sudokuHintsSchema, type SudokuHints } from '@/puzzles/sudoku/hints'
import { parseSudoku, sudokuRawSchema, type SudokuRaw } from '@/puzzles/sudoku/parse'

// eslint-disable-next-line unicorn/consistent-boolean-name
export const prerender = false

/**
Parse only. Whether a read is trustworthy is the browser's call, where the solver has a real clock.
*/
export const POST = createExtractHandler<SudokuRaw, SudokuPuzzleWire, SudokuHints>({
  puzzleId: 'sudoku',
  maxImageBytes: SUDOKU_MAX_IMAGE_BYTES,
  schema: SUDOKU_EXTRACTION_SCHEMA,
  hintsSchema: sudokuHintsSchema,
  prompt: sudokuExtractionPrompt,
  responseSchema: sudokuRawSchema,
  interpret: (raw) => {
    const parsed = parseSudoku(raw)
    if (!parsed.ok) {
      return { ok: false, message: parsed.message }
    }
    return {
      ok: true,
      result: puzzleToWire({ grid: parsed.grid, uncertain: parsed.uncertain }),
      logFields: {
        n: parsed.grid.n,
        givens: parsed.grid.values.filter((value) => value !== 0).length,
        uncertainCount: parsed.uncertain.length,
      },
    }
  },
})
