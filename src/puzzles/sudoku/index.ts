import type { ExtractResponse, PuzzleDefinition } from '@/puzzles/types'

import {
  gridFromWire,
  SUDOKU_EXTRACT_PATH,
  SUDOKU_MAX_IMAGE_EDGE,
  SUDOKU_VISION_MODELS,
  type SudokuExtractRequest,
  type SudokuExtractResponse,
} from './api'
import { createGrid, type SudokuGrid, type SudokuSolution } from './model'
import { solveSudoku } from './solve'

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x80_00
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

async function extract(image: Blob): Promise<ExtractResponse<SudokuGrid>> {
  let response: Response
  try {
    response = await fetch(SUDOKU_EXTRACT_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mediaType: image.type || 'image/jpeg',
        data: await blobToBase64(image),
        models: SUDOKU_VISION_MODELS,
      } satisfies SudokuExtractRequest),
    })
  } catch {
    return {
      ok: false,
      error: { code: 'network', message: 'Could not reach the server. Check your connection.' },
    }
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error: {
        code: 'network',
        message: 'Your session expired. Reload the page to sign in again.',
      },
    }
  }

  let body: SudokuExtractResponse
  try {
    body = (await response.json()) as SudokuExtractResponse
  } catch {
    return {
      ok: false,
      error: { code: 'model_failed', message: 'The server returned an unreadable response.' },
    }
  }

  if (!body.ok) {
    return body
  }
  return { ok: true, puzzle: gridFromWire(body.puzzle), uncertain: body.uncertain }
}

export const sudoku: PuzzleDefinition<SudokuGrid, SudokuSolution> = {
  id: 'sudoku',
  name: 'Sudoku',
  blurb: 'Take a picture of a Sudoku and get it solved. Sizes from 4x4 to 16x16.',
  maxImageEdge: SUDOKU_MAX_IMAGE_EDGE,
  extract,
  solve: (grid, options) => solveSudoku(grid, options),
  blank: () => createGrid(9, 3, 3),
}
