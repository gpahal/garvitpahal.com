import { postExtract } from '@/lib/vision/extract-client'
import type { ExtractResponse, PuzzleDefinition } from '@/puzzles/types'

import {
  KEN_KEN_EXTRACT_PATH,
  KEN_KEN_MAX_IMAGE_EDGE,
  KEN_KEN_VISION_MODELS,
  puzzleFromWire,
  type KenKenPuzzleWire,
} from './api'
import { createGrid, type KenKenPuzzle, type KenKenSolution } from './model'
import { solveKenKen } from './solve'
import { findSolveBlocker } from './validate'

async function extract(image: Blob): Promise<ExtractResponse<KenKenPuzzle>> {
  const response = await postExtract<KenKenPuzzleWire>(
    KEN_KEN_EXTRACT_PATH,
    image,
    KEN_KEN_VISION_MODELS,
  )
  return response.ok ? { ok: true, puzzle: puzzleFromWire(response.puzzle) } : response
}

export const kenKen: PuzzleDefinition<KenKenPuzzle, KenKenSolution> = {
  id: 'ken-ken',
  name: 'Ken Ken',
  blurb: 'Take a picture of a Ken Ken and get it solved. Sizes from 4x4 to 8x8.',
  maxImageEdge: KEN_KEN_MAX_IMAGE_EDGE,
  extract,
  solve: solveKenKen,
  blank: () => ({ grid: createGrid(6), unreviewedCages: [] }),
  unreviewedCount: (puzzle) => puzzle.unreviewedCages.length,
  solveBlocker: (puzzle) => findSolveBlocker(puzzle.grid),
}
