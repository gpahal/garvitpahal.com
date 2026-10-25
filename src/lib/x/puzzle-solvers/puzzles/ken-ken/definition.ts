import { createWireRead } from '../../vision/extract-client'
import type { PuzzleDefinition } from '../types'
import { KEN_KEN_ID, kenKenPuzzleWireSchema, puzzleFromWire } from './api'
import { createPuzzle, KEN_KEN_SIZES } from './model'
import type { KenKenPuzzle } from './model'
import { findSolveBlocker } from './validate'

export const kenKen: PuzzleDefinition<KenKenPuzzle, typeof KEN_KEN_ID> = {
  id: KEN_KEN_ID,
  name: 'Ken Ken',
  blurb: `Take a picture of a Ken Ken and get it solved. Sizes from ${KEN_KEN_SIZES.range}`,
  read: createWireRead(KEN_KEN_ID, kenKenPuzzleWireSchema, puzzleFromWire),
  blank: () => createPuzzle(6),
  unreviewedCount: (puzzle) => puzzle.unreviewedCages.length,
  reviewUnit: 'cage',
  solveBlocker: (puzzle) => findSolveBlocker(puzzle.grid),
  timeoutHint:
    'Large cages can have too many combinations to check. Check the clue and cells of each large cage, then try again',
}
