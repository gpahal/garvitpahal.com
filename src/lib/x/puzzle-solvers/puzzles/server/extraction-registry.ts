import type { Extraction } from '../../vision/server/extract-handler'
import { kenKenExtraction } from '../ken-ken/server/extraction'
import type { PuzzleId } from '../registry'
import { sudokuExtraction } from '../sudoku/server/extraction'

export const EXTRACTIONS: Readonly<Record<PuzzleId, Extraction>> = {
  sudoku: sudokuExtraction,
  'ken-ken': kenKenExtraction,
}
