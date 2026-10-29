import { pluralize } from '@/lib/text'

import { gridSizes } from '../../grid/geometry'
import { cellsByLabel } from '../../grid/regions'

export const KEN_KEN_SIZES = gridSizes([4, 5, 6, 7, 8])

export type KenKenSize = (typeof KEN_KEN_SIZES.list)[number]

/**
 * ASCII, because these go straight into the extraction schema's enum and `×`, `÷` and `−` have
 * lookalike codepoints a model can drift to. `=` is a single-cell cage, which is a given.
 */
export const CAGE_OPS = ['+', '-', '*', '/', '='] as const

export type CageOp = (typeof CAGE_OPS)[number]

/**
 * `target: 0` means unset, not a cage totalling zero.
 */
export type Cage = {
  op: CageOp
  target: number
}

export type KenKenGrid = {
  n: number
  cageOf: Uint8Array
  cages: Array<Cage>
}

export type KenKenPuzzle = {
  grid: KenKenGrid
  unreviewedCages: Array<number>
  /**
   * The subset of `unreviewedCages` the parser found inconsistent. Only these veto trusting a read:
   * a model flagging a cage it got right is being careful, but a layout contradicting its own clue
   * list was misread somewhere.
   */
  contradictions: Array<number>
}

export function cageIdAt(grid: KenKenGrid, cell: number): number {
  return grid.cageOf[cell] ?? 0
}

/**
 * Each in reading order, so a cage's first cell is the leftmost of its top row, where the clue is
 * printed.
 */
export function cellsByCage(grid: KenKenGrid): Array<Array<number>> {
  return cellsByLabel(grid.cageOf, grid.cages.length)
}

export function clueCells(byCage: Array<Array<number>>): Set<number> {
  return new Set(byCage.flatMap((cells) => cells.slice(0, 1)))
}

export function cageCells(grid: KenKenGrid, cageId: number): Array<number> {
  return cellsByCage(grid)[cageId] ?? []
}

export function createGrid(n: number): KenKenGrid {
  const cageOf = new Uint8Array(n * n)
  const cages: Array<Cage> = []
  for (let cell = 0; cell < n * n; cell++) {
    cageOf[cell] = cell
    cages.push({ op: '=', target: 0 })
  }
  return { n, cageOf, cages }
}

export function isBlankGrid(grid: KenKenGrid): boolean {
  return (
    new Set(grid.cageOf).size === grid.cageOf.length &&
    grid.cages.every((cage) => cage.target === 0)
  )
}

export function createPuzzle(n: number): KenKenPuzzle {
  return { grid: createGrid(n), unreviewedCages: [], contradictions: [] }
}

/**
 * Separated, because cage ids reach two digits: run together, `1,12` and `11,2` would make two
 * misreads agree.
 */
export function gridFingerprint(grid: KenKenGrid): string {
  const clues = grid.cages.map((cage) => `${cage.op}${String(cage.target)}`)
  return `${String(grid.n)};${grid.cageOf.join(',')};${clues.join(',')}`
}

export function cloneGrid(grid: KenKenGrid): KenKenGrid {
  return {
    n: grid.n,
    cageOf: Uint8Array.from(grid.cageOf),
    cages: grid.cages.map((cage) => ({ ...cage })),
  }
}

export const OP_SYMBOLS: Record<CageOp, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
  '=': '',
}

const OP_WORDS: Record<CageOp, string> = {
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divided by',
  '=': '',
}

/**
 * Operator first, matching the apps these puzzles are usually photographed from; the extraction
 * prompt accepts either order.
 */
export function formatClue(cage: Cage): string {
  return cage.target === 0 ? '' : `${OP_SYMBOLS[cage.op]}${String(cage.target)}`
}

/**
 * For screen readers, since the clue itself is decorative.
 */
export function describeCage(grid: KenKenGrid, cell: number, cellCount: number): string {
  const cage = grid.cages[cageIdAt(grid, cell)]
  if (!cage) {
    return 'no cage'
  }
  const size = pluralize(cellCount, 'cell')
  if (cage.target === 0) {
    return `cage of ${size}, no clue yet`
  }
  return cage.op === '='
    ? `cage of ${size}, given ${String(cage.target)}`
    : `cage of ${size}, ${OP_WORDS[cage.op]} ${String(cage.target)}`
}
