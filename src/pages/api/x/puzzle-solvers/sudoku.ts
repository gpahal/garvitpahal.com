import { createExtractHandler } from '@/lib/vision/extract-endpoint'
import { puzzleToWire, SUDOKU_MAX_IMAGE_BYTES, type SudokuPuzzleWire } from '@/puzzles/sudoku/api'
import { SUDOKU_EXTRACTION_PROMPT, SUDOKU_EXTRACTION_SCHEMA } from '@/puzzles/sudoku/extraction'
import { parseSudoku, sudokuRawSchema, type SudokuRaw } from '@/puzzles/sudoku/parse'
import { solveSudoku } from '@/puzzles/sudoku/solve'

// eslint-disable-next-line unicorn/consistent-boolean-name
export const prerender = false

/** Only decides whether a read looks trustworthy, so it is tighter than a user-initiated solve. */
const VERIFY_TIMEOUT_MS = 1000

export const POST = createExtractHandler<SudokuRaw, SudokuPuzzleWire>({
  puzzleId: 'sudoku',
  maxImageBytes: SUDOKU_MAX_IMAGE_BYTES,
  schema: SUDOKU_EXTRACTION_SCHEMA,
  prompt: SUDOKU_EXTRACTION_PROMPT,
  responseSchema: sudokuRawSchema,
  interpret: (raw) => {
    const parsed = parseSudoku(raw)
    if (!parsed.ok) {
      return { ok: false, message: parsed.message }
    }

    // A printed Sudoku has exactly one solution, so anything else means a digit was misread. A solve
    // that ran out of time before ruling out a second solution proves nothing, so it is not enough.
    const solved = solveSudoku(parsed.grid, { timeoutMs: VERIFY_TIMEOUT_MS })
    const isTrusted = solved.status === 'solved' && solved.isUnique

    return {
      ok: true,
      result: puzzleToWire({ grid: parsed.grid, uncertain: parsed.uncertain }),
      confidence: isTrusted ? 'trusted' : 'suspect',
      logFields: {
        n: parsed.grid.n,
        solveStatus: solved.status,
        isUnique: solved.status === 'solved' ? solved.isUnique : null,
        uncertainCount: parsed.uncertain.length,
      },
    }
  },
})
