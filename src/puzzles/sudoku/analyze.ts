import { guessPolarity, splitBimodal, strokeContrast, type GrayImage } from '@/lib/capture/pixels'
import type { CellRef } from '@/lib/grid/geometry'
import {
  cellInk,
  detectLattice,
  lineMasses,
  splitHeavy,
  type Lattice,
  type LineWeights,
} from '@/lib/grid/lines'

import type { SudokuHints } from './hints'
import { isValidBoxGeometry, SUDOKU_SIZES, type SudokuSize } from './model'

/**
Wider than the heaviest stroke at 1024px, so a line stands out from its own surroundings.
*/
const CONTRAST_RADIUS = 20

/**
Box lines are several times a cell line's mass; anything closer than this is not a clear pattern.
*/
const BOX_LINE_MIN_SEPARATION = 0.3

/**
 * An empty cell is nearly ink-free and a printed digit is several percent ink, so the split is
 * demanded to be that lopsided: the emptier group must be near zero and the other clearly above
 * it. A grid of thin `1`s next to bold `8`s would otherwise split between digits.
 */
const EMPTY_MAX_INK = 0.015
const FILLED_MIN_RATIO = 4

export type SudokuAnalysis = {
  lattice: Lattice<SudokuSize> | undefined
  hints: SudokuHints
}

/**
 * Thick lines every `boxWidth` columns and `boxHeight` rows, or nothing. The pattern has to be
 * exact: a single misplaced heavy line means the picture is not a regular box sudoku, or was not
 * read cleanly, and either way a guessed geometry is worse than none.
 */
function detectBoxGeometry(
  weights: LineWeights,
  n: number,
): { boxWidth: number; boxHeight: number } | undefined {
  const boxWidth = boxSpan(weights.vertical, n)
  const boxHeight = boxSpan(weights.horizontal, n)
  if (
    boxWidth === undefined ||
    boxHeight === undefined ||
    !isValidBoxGeometry(n, boxWidth, boxHeight)
  ) {
    return undefined
  }
  return { boxWidth, boxHeight }
}

function boxSpan(masses: Array<number>, n: number): number | undefined {
  const split = splitHeavy(masses, BOX_LINE_MIN_SEPARATION)
  if (!split) {
    return undefined
  }
  const heavy: Array<number> = []
  for (const [index, mass] of masses.entries()) {
    if (split.isHeavy(mass)) {
      heavy.push(index + 1)
    }
  }
  const span = n / (heavy.length + 1)
  if (!Number.isSafeInteger(span)) {
    return undefined
  }
  return heavy.every((line, index) => line === (index + 1) * span) ? span : undefined
}

function detectEmptyCells(ink: Array<number>, n: number): Array<CellRef> | undefined {
  const split = splitBimodal(ink)
  const emptiest = split.low.at(-1)
  const fullest = split.high[0]
  if (
    emptiest === undefined ||
    fullest === undefined ||
    emptiest > EMPTY_MAX_INK ||
    fullest < FILLED_MIN_RATIO * Math.max(emptiest, EMPTY_MAX_INK / 2)
  ) {
    return undefined
  }
  const empty: Array<CellRef> = []
  for (const [cell, value] of ink.entries()) {
    if (value <= split.threshold) {
      empty.push({ row: Math.floor(cell / n), col: cell % n })
    }
  }
  return empty
}

/**
 * What can be read off a rectified sudoku without reading a digit: the size, where the box lines
 * fall, and which cells hold nothing. Each is offered only when unambiguous.
 */
export function analyzeSudoku(gray: GrayImage): SudokuAnalysis {
  const contrast = strokeContrast(gray, CONTRAST_RADIUS, guessPolarity(gray))
  const lattice = detectLattice(contrast, SUDOKU_SIZES)
  if (!lattice) {
    return { lattice: undefined, hints: {} }
  }

  const hints: SudokuHints = { n: lattice.n }
  const geometry = detectBoxGeometry(lineMasses(contrast, lattice), lattice.n)
  if (geometry) {
    hints.boxWidth = geometry.boxWidth
    hints.boxHeight = geometry.boxHeight
  }
  const empty = detectEmptyCells(cellInk(contrast, lattice), lattice.n)
  if (empty) {
    hints.empty = empty
  }
  return { lattice, hints }
}
