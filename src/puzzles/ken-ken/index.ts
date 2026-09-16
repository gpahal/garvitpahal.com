import { pixelsToJpeg, WHOLE_PICTURE_JPEG_QUALITY } from '@/lib/capture/encode'
import { enhance } from '@/lib/capture/enhance'
import { toGray } from '@/lib/capture/pixels'
import { rectify, wholePicture, type Capture } from '@/lib/capture/rectify'
import { streamExtract } from '@/lib/vision/extract-client'
import { VERIFY_TIMEOUT_MS } from '@/puzzles/solve-result'
import type {
  ExtractOptions,
  ExtractOutcome,
  PuzzleDefinition,
  ReadAssessment,
} from '@/puzzles/types'

import { analyzeKenKen } from './analyze'
import {
  KEN_KEN_EXTRACT_PATH,
  KEN_KEN_MAX_IMAGE_EDGE,
  KEN_KEN_MAX_PICTURE_EDGE,
  KEN_KEN_VISION_MODELS,
  puzzleFromWire,
  type KenKenPuzzleWire,
} from './api'
import type { KenKenHints } from './hints'
import { createGrid, type KenKenPuzzle, type KenKenSolution } from './model'
import { solveKenKen } from './solve'
import { findSolveBlocker } from './validate'

export type KenKenPrepared = {
  image: Blob
  hints: KenKenHints
}

/**
 * Measure the crop, send the whole picture. The hints are what cut the read from 39s to 10s on
 * the bench's 6x6; the crop itself made a blurred clue's operator harder to read, not easier, so
 * the model gets the frame as the camera saw it and the analysis keeps the rectified copy to
 * itself.
 */
async function prepare(capture: Capture): Promise<KenKenPrepared> {
  const crop = enhance(rectify(capture, KEN_KEN_MAX_IMAGE_EDGE))
  const analysis = analyzeKenKen(toGray(crop))
  const picture = wholePicture(capture, KEN_KEN_MAX_PICTURE_EDGE)
  return { image: await pixelsToJpeg(picture, WHOLE_PICTURE_JPEG_QUALITY), hints: analysis.hints }
}

async function extract(
  prepared: KenKenPrepared,
  options: ExtractOptions<KenKenPuzzle>,
): Promise<ExtractOutcome> {
  return streamExtract<KenKenPuzzleWire, KenKenHints>(
    KEN_KEN_EXTRACT_PATH,
    { image: prepared.image, models: KEN_KEN_VISION_MODELS, hints: prepared.hints },
    {
      signal: options.signal,
      onRead: (wire, meta) => {
        options.onRead(puzzleFromWire(wire), meta)
      },
    },
  )
}

/**
 * A unique solve of a layout with no internal contradiction is proof of a correct read, and no
 * solution is proof of a wrong one. A read the parser caught contradicting itself is never
 * trusted, not even by agreement with another: the benchmark's misreads were systematic, so two
 * models clipping the same cage the same way is exactly what agreement must not paper over. The
 * model's own `uncertain` list is not a veto - it drives the review banner instead, because a
 * model that hedges about a cage it read correctly was being careful, not wrong.
 */
function assess(puzzle: KenKenPuzzle): ReadAssessment {
  const solved = solveKenKen(puzzle, { timeoutMs: VERIFY_TIMEOUT_MS })
  if (solved.status === 'unsolvable') {
    return { confidence: 'misread' }
  }
  if (puzzle.contradictions.length > 0) {
    return { confidence: 'suspect' }
  }
  const { grid } = puzzle
  const fingerprint = `${String(grid.n)},${[...grid.cageOf].join('')},${grid.cages
    .map((cage) => `${cage.op}${String(cage.target)}`)
    .join(',')}`
  return {
    confidence: solved.status === 'solved' && solved.isUnique ? 'trusted' : 'suspect',
    fingerprint,
  }
}

export const kenKen: PuzzleDefinition<KenKenPuzzle, KenKenSolution, KenKenPrepared> = {
  id: 'ken-ken',
  name: 'Ken Ken',
  blurb: 'Take a picture of a Ken Ken and get it solved. Sizes from 4x4 to 8x8.',
  prepare,
  extract,
  assess,
  solve: solveKenKen,
  blank: () => ({ grid: createGrid(6), unreviewedCages: [], contradictions: [] }),
  unreviewedCount: (puzzle) => puzzle.unreviewedCages.length,
  solveBlocker: (puzzle) => findSolveBlocker(puzzle.grid),
}
