import type { Extraction } from '../../vision/server/extract-handler'
import { kenKenExtraction } from '../ken-ken/server/extraction'
import type { PuzzleId } from '../registry'
import { sudokuExtraction } from '../sudoku/server/extraction'

/**
 * Served at `/api/x/puzzle-solvers/<id>`, the path `createWireRead` posts to.
 */
export const EXTRACTIONS: Readonly<Record<PuzzleId, Extraction>> = {
  sudoku: sudokuExtraction,
  'ken-ken': kenKenExtraction,
}
