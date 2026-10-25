import { splitBimodal, toGray } from '../../capture/pixels'
import type { PixelImage } from '../../capture/pixels'
import { colOf, rowOf } from '../../grid/geometry'
import type { CellRef } from '../../grid/geometry'
import { cellInk, lineMasses, readLattice, splitHeavy } from '../../grid/lines'
import type { LineWeights } from '../../grid/lines'
import type { SudokuHints } from './api'
import { isValidBoxGeometry, SUDOKU_SIZES } from './model'

/**
 * Box lines are several times a cell line's mass; anything closer than this is not a clear pattern.
 */
const BOX_LINE_MIN_SEPARATION = 0.3

/**
 * The split must be lopsided, the emptier group near zero: a grid of thin `1`s beside bold `8`s
 * would otherwise split between digits.
 */
const EMPTY_MAX_INK = 0.015
const FILLED_MIN_RATIO = 4

/**
 * Exact or nothing: one misplaced heavy line means the picture is not a regular box Sudoku or was
 * misread, and a guessed geometry is worse than none.
 */
function detectBoxGeometry(
  weights: LineWeights,
  n: number,
): { boxWidth: number; boxHeight: number } | undefined {
  const boxWidth = boxSpan(weights.vertical, n)
  const boxHeight = boxSpan(weights.horizontal, n)
  return boxWidth === undefined ||
    boxHeight === undefined ||
    !isValidBoxGeometry(n, boxWidth, boxHeight)
    ? undefined
    : { boxWidth, boxHeight }
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
  const inkiestEmpty = split.low.at(-1)
  const faintestFilled = split.high[0]
  if (
    inkiestEmpty === undefined ||
    faintestFilled === undefined ||
    inkiestEmpty > EMPTY_MAX_INK ||
    faintestFilled < FILLED_MIN_RATIO * Math.max(inkiestEmpty, EMPTY_MAX_INK / 2)
  ) {
    return undefined
  }
  const empty: Array<CellRef> = []
  for (const [cell, value] of ink.entries()) {
    if (value <= split.threshold) {
      empty.push({ row: rowOf(n, cell), col: colOf(n, cell) })
    }
  }
  return empty
}

export function analyzeSudoku(crop: PixelImage): SudokuHints {
  const { contrast, lattice } = readLattice(toGray(crop), SUDOKU_SIZES.list)
  if (!lattice) {
    return {}
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
  return hints
}
