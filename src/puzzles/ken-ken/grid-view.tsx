import type { CSSProperties, ReactNode, Ref } from 'react'

import { colOf, indexOf, isInside, rowOf } from '@/lib/grid/geometry'

import { cageAnchor, cageIdAt, formatClue, type KenKenGrid } from './model'

/** Presentation both the editor and the solution need, so neither has to import the other. */

type WallDirection = 'up' | 'left'

const STEPS: Record<WallDirection, { row: number; col: number }> = {
  up: { row: -1, col: 0 },
  left: { row: 0, col: -1 },
}

/**
 * A wall exists between two cells exactly when they are in different cages. Membership is the only
 * source of truth, so there is no separate wall map that could fall out of step with it - and a wall
 * is only ever drawn, never edited: `applyDraft` moves cells between cages, and the lines follow.
 */
function hasWall(grid: KenKenGrid, cell: number, direction: WallDirection): boolean {
  const { n } = grid
  const step = STEPS[direction]
  const row = rowOf(n, cell) + step.row
  const col = colOf(n, cell) + step.col
  return !isInside(n, row, col) || cageIdAt(grid, cell) !== cageIdAt(grid, indexOf(n, row, col))
}

/** An 8x8 packs its cells tighter, so its values need to be a shade smaller to stay centred. */
export function cellTextClass(n: number): string {
  return n > 6 ? 'text-[clamp(0.6rem,3vw,1rem)]' : 'text-[clamp(0.7rem,3.5vw,1.15rem)]'
}

/** Clue type, sized to stay legible without crowding a cage's corner on the tightest grid. */
export function clueTextClass(n: number): string {
  return n > 6 ? 'text-[clamp(0.6rem,2vw,0.78rem)]' : 'text-[clamp(0.7rem,2.6vw,0.95rem)]'
}

/**
 * Only the top and left edges are drawn per cell, plus the grid's own right and bottom, so two
 * adjacent cells never each draw the same line and double its width.
 *
 * Cage edges are 3px `gray-11` against the 1px `gray-6` between cells inside a cage. Reading which
 * cells are grouped is the whole puzzle, so the two kinds of line are pushed as far apart on both
 * width and darkness as the palette allows short of `gray-12`, which the values themselves use and
 * which would let the frame compete with them.
 */
export function cageBorderClasses(grid: KenKenGrid, cell: number): string {
  const { n } = grid
  return [
    'border-gray-6 border-t border-l',
    hasWall(grid, cell, 'left') ? 'border-l-gray-11 border-l-[3px]' : '',
    hasWall(grid, cell, 'up') ? 'border-t-gray-11 border-t-[3px]' : '',
    colOf(n, cell) === n - 1 ? 'border-r-gray-11 border-r-[3px]' : '',
    rowOf(n, cell) === n - 1 ? 'border-b-gray-11 border-b-[3px]' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/** The clue, printed in the cage's top-left cell exactly as a paper puzzle prints it. */
export function CageClue({
  grid,
  cell,
  className,
  hasPlaceholder = false,
}: {
  grid: KenKenGrid
  cell: number
  className?: string
  /**
   * Marks a cage that has no clue yet with a `?`.
   *
   * Without it such a cage is invisible: an empty corner is exactly what every cell that is not an
   * anchor looks like, so "a cage still needs a clue" would be true but unfindable. Muted rather
   * than an error, because on a grid being entered by hand every cage starts this way.
   */
  hasPlaceholder?: boolean
}): ReactNode {
  const cageId = cageIdAt(grid, cell)
  if (cageAnchor(grid, cageId) !== cell) {
    return undefined
  }

  const cage = grid.cages[cageId]
  if (!cage) {
    return undefined
  }

  const isUnset = cage.target === 0
  if (isUnset && !hasPlaceholder) {
    return undefined
  }

  return (
    <span
      aria-hidden="true"
      className={`absolute top-0.5 left-1 leading-none font-semibold ${clueTextClass(grid.n)} ${
        isUnset ? 'text-gray-8' : (className ?? 'text-gray-11')
      }`}
    >
      {isUnset ? '?' : formatClue(cage)}
    </span>
  )
}

/** Describes a cage the way a screen reader should hear it, since the clue itself is decorative. */
export function describeCage(grid: KenKenGrid, cell: number, cellCount: number): string {
  const cage = grid.cages[cageIdAt(grid, cell)]
  if (!cage) {
    return 'no cage'
  }
  const size = cellCount === 1 ? '1 cell' : `${String(cellCount)} cells`
  if (cage.target === 0) {
    return `cage of ${size}, no clue yet`
  }
  const named = { '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by', '=': '' }[cage.op]
  return cage.op === '='
    ? `cage of ${size}, given ${String(cage.target)}`
    : `cage of ${size}, ${named} ${String(cage.target)}`
}

/**
 * Renders cells per row rather than as one flat run, because `gridcell` is only meaningful inside a
 * `row` - and `aria-rowindex` on a cell with no row to belong to says nothing at all. The wrappers
 * are `display: contents`, so the CSS grid still lays every cell out against the same tracks.
 */
export function GridFrame({
  n,
  label,
  renderCell,
  className,
  ref,
}: {
  n: number
  label: string
  renderCell: (cell: number) => ReactNode
  className?: string
  ref?: Ref<HTMLDivElement>
}): ReactNode {
  const style: CSSProperties = { gridTemplateColumns: `repeat(${String(n)}, minmax(0, 1fr))` }

  return (
    <div
      ref={ref}
      role="grid"
      aria-label={label}
      aria-rowcount={n}
      aria-colcount={n}
      className={`mx-auto grid w-full max-w-md ${className ?? ''}`}
      style={style}
    >
      {Array.from({ length: n }, (_, row) => (
        <div key={row} role="row" className="contents">
          {Array.from({ length: n }, (_, col) => renderCell(indexOf(n, row, col)))}
        </div>
      ))}
    </div>
  )
}
