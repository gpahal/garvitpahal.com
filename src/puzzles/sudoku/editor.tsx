import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { indexOf } from '@/lib/grid/geometry'
import { SelectionMarker } from '@/components/x/ui/selection-marker'
import { useClickOutside } from '@/components/x/ui/use-click-outside'
import { useRovingFocus } from '@/components/x/ui/use-roving-focus'
import type { PuzzleEditorProps } from '@/puzzles/types'

import {
  cloneGrid,
  defaultBoxGeometry,
  EMPTY,
  findConflicts,
  formatValue,
  parseKeyboardValue,
  resizeGrid,
  SUDOKU_SIZES,
  type SudokuGrid,
  type SudokuPuzzle,
} from './model'

const PAD_BUTTON =
  'unstyled border-gray-6 hocus-visible:bg-gray-4 focus-visible:ring-anchor inline-flex h-9 items-center justify-center rounded-md border text-sm font-medium focus-visible:ring-2 focus-visible:outline-none'

/** Values 10-16 render as two digits, so larger grids need smaller type to avoid overflow. */
export function cellTextClass(n: number): string {
  return n > 9 ? 'text-[clamp(0.5rem,2.2vw,0.8rem)]' : 'text-[clamp(0.7rem,3.5vw,1.15rem)]'
}

export function cellBorderClasses(grid: SudokuGrid, row: number, col: number): string {
  const { n, boxWidth, boxHeight } = grid
  return [
    'border-gray-6 border-t border-l',
    col % boxWidth === 0 ? 'border-l-gray-8 border-l-2' : '',
    row % boxHeight === 0 ? 'border-t-gray-8 border-t-2' : '',
    col === n - 1 ? 'border-r-gray-8 border-r-2' : '',
    row === n - 1 ? 'border-b-gray-8 border-b-2' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * `onBlockerChange` goes unused: every edit here lands on the puzzle the moment it is made, so there
 * is never uncommitted work the way a Ken Ken cage draft is.
 */
export function SudokuEditor({ puzzle, onChange }: PuzzleEditorProps<SudokuPuzzle>): ReactNode {
  const { grid, uncertain } = puzzle
  const { n } = grid
  // Nothing is selected until the user picks a cell, including on first render: a grid that arrives
  // with a cell already outlined claims a choice the user has not made yet.
  const [selected, setSelected] = useState<number | undefined>(undefined)
  const gridRef = useRovingFocus<HTMLDivElement>(selected)
  const rootRef = useClickOutside<HTMLDivElement>(() => {
    setSelected(undefined)
  })

  const conflicts = useMemo(() => new Set(findConflicts(grid)), [grid])
  const uncertainSet = useMemo(
    () => new Set(uncertain.map((cell) => indexOf(n, cell.row, cell.col))),
    [uncertain, n],
  )

  const setValue = useCallback(
    (cell: number, value: number) => {
      const next = cloneGrid(grid)
      next.values[cell] = value
      // Typing into a cell is the user reviewing it, so it stops being flagged.
      onChange({
        grid: next,
        uncertain: uncertain.filter((ref) => indexOf(n, ref.row, ref.col) !== cell),
      })
    },
    [grid, n, uncertain, onChange],
  )

  // Clones rather than rebuilding from the size, so a non-rectangular region map would survive.
  const clearAll = useCallback(() => {
    const next = cloneGrid(grid)
    next.values.fill(EMPTY)
    onChange({ grid: next, uncertain: [] })
  }, [grid, onChange])

  const hasValues = useMemo(() => grid.values.some((value) => value !== EMPTY), [grid])

  // On the cells, not the grid: with a roving tabindex the focused element is a cell, and a handler
  // on a container that can never hold focus is one the keyboard only reaches by accident.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (selected === undefined) {
        return
      }

      const row = Math.floor(selected / n)
      const col = selected % n
      let isHandled = true

      switch (event.key) {
        case 'ArrowUp': {
          setSelected(indexOf(n, Math.max(0, row - 1), col))
          break
        }
        case 'ArrowDown': {
          setSelected(indexOf(n, Math.min(n - 1, row + 1), col))
          break
        }
        case 'ArrowLeft': {
          setSelected(indexOf(n, row, Math.max(0, col - 1)))
          break
        }
        case 'ArrowRight': {
          setSelected(indexOf(n, row, Math.min(n - 1, col + 1)))
          break
        }
        case 'Backspace':
        case 'Delete': {
          setValue(selected, EMPTY)
          break
        }
        case 'Escape': {
          // The keyboard's way out, since a press on the page is what clears it with a pointer.
          setSelected(undefined)
          event.currentTarget.blur()
          break
        }
        default: {
          const value = parseKeyboardValue(event.key, n)
          if (value !== EMPTY) {
            setValue(selected, value)
          } else {
            isHandled = false
          }
        }
      }

      if (isHandled) {
        event.preventDefault()
      }
    },
    [n, selected, setValue],
  )

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      <SizePad
        grid={grid}
        onResize={(next) => {
          // A resize re-indexes every cell, so a selection kept across it can point past the end of
          // the new grid - where typing silently writes nowhere and no cell shows as selected.
          setSelected(undefined)
          onChange({ grid: next, uncertain: [] })
        }}
      />

      {/* Cells are grouped per row because `gridcell` is only meaningful inside a `row`. The
          wrappers are `display: contents`, so the CSS grid lays every cell out as before. */}
      <div
        ref={gridRef}
        role="grid"
        aria-label={`${String(n)} by ${String(n)} Sudoku grid`}
        aria-rowcount={n}
        aria-colcount={n}
        className="mx-auto grid w-full max-w-md rounded-md"
        style={{ gridTemplateColumns: `repeat(${String(n)}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: n }, (_, row) => (
          <div key={row} role="row" className="contents">
            {Array.from({ length: n }, (_, col) => {
              const cell = indexOf(n, row, col)
              const value = grid.values[cell] ?? EMPTY
              const isSelected = cell === selected
              const isConflict = conflicts.has(cell)
              const isUncertain = uncertainSet.has(cell)

              return (
                <button
                  key={cell}
                  type="button"
                  role="gridcell"
                  aria-rowindex={row + 1}
                  aria-colindex={col + 1}
                  aria-label={`Row ${String(row + 1)}, column ${String(col + 1)}${
                    value === EMPTY ? ', empty' : `, ${formatValue(value)}`
                  }${isUncertain ? ', needs review' : ''}${isConflict ? ', conflicts' : ''}`}
                  // Roving: only the selected cell is tabbable, so arrow keys move real focus and
                  // each cell's label is announced as it is reached. With nothing selected the
                  // first cell stands in, or Tab would have no way into the grid at all.
                  tabIndex={isSelected || (selected === undefined && cell === 0) ? 0 : -1}
                  onKeyDown={onKeyDown}
                  // Selection follows focus, so tabbing in picks the cell up rather than leaving a
                  // focused cell that the controls below say nothing about.
                  onFocus={() => {
                    setSelected(cell)
                  }}
                  onClick={() => {
                    setSelected(cell)
                  }}
                  className={[
                    'unstyled relative flex aspect-square items-center justify-center font-semibold',
                    cellTextClass(n),
                    cellBorderClasses(grid, row, col),
                    isConflict
                      ? 'z-10 bg-gray-5 ring-2 ring-gray-12'
                      : isUncertain
                        ? 'z-10 bg-gray-4 ring-1 ring-gray-8'
                        : 'bg-bg hocus-visible:bg-gray-3',
                    // Raised so the marker below is not clipped by a neighbour's border.
                    isSelected ? 'z-20' : '',
                    'text-gray-12',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {isSelected ? <SelectionMarker /> : undefined}
                  <span
                    className={isUncertain ? 'underline decoration-dotted underline-offset-4' : ''}
                  >
                    {formatValue(value)}
                  </span>
                  {isConflict ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-0 right-0.5 text-[0.6rem] leading-none text-gray-12"
                    >
                      !
                    </span>
                  ) : undefined}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Every control here acts on the selected cell, so with none there is nothing for them to
          do - and a pad that writes nowhere is worse than a line saying what to do first. */}
      {selected === undefined ? (
        <p role="status" className="unstyled my-0! text-center text-sm text-gray-11">
          Select a cell to enter a value
        </p>
      ) : (
        <ValuePad
          n={n}
          onPick={(value) => {
            setValue(selected, value)
          }}
          onClearAll={clearAll}
          hasValues={hasValues}
        />
      )}
    </div>
  )
}

/**
 * Size lives with the editor because changing it is almost always a correction. A resize re-indexes
 * every cell, so the caller drops the review flags rather than pointing them at unrelated cells.
 */
function SizePad({
  grid,
  onResize,
}: {
  grid: SudokuGrid
  onResize: (grid: SudokuGrid) => void
}): ReactNode {
  const { n, boxWidth, boxHeight } = grid

  return (
    <div
      role="group"
      aria-label="Grid size"
      className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-1"
    >
      {SUDOKU_SIZES.map((size) => (
        <button
          key={size}
          type="button"
          aria-pressed={size === n}
          onClick={() => {
            // Re-picking the current size would reset a box orientation the user chose below.
            if (size === n) {
              return
            }
            const geometry = defaultBoxGeometry(size)
            onResize(resizeGrid(grid, size, geometry.boxWidth, geometry.boxHeight))
          }}
          className={`${PAD_BUTTON} px-2.5 ${
            size === n ? 'border-gray-12 bg-gray-12 text-gray-1' : 'text-gray-12'
          }`}
        >
          {size}&times;{size}
        </button>
      ))}

      {/* A 6x6 with 3x2 boxes and one with 2x3 boxes are different puzzles, not a style choice. */}
      {boxWidth === boxHeight ? undefined : (
        <button
          type="button"
          aria-label={`Boxes are ${String(boxWidth)} wide by ${String(boxHeight)} tall. Switch to ${String(boxHeight)} by ${String(boxWidth)}.`}
          onClick={() => {
            onResize(resizeGrid(grid, n, boxHeight, boxWidth))
          }}
          className={`${PAD_BUTTON} px-2.5 text-gray-11`}
        >
          Boxes {boxWidth}&times;{boxHeight}
        </button>
      )}
    </div>
  )
}

function ValuePad({
  n,
  onPick,
  onClearAll,
  hasValues,
}: {
  n: number
  onPick: (value: number) => void
  onClearAll: () => void
  hasValues: boolean
}): ReactNode {
  return (
    <div className="mx-auto flex max-w-md flex-wrap justify-center gap-1">
      {Array.from({ length: n }, (_, index) => index + 1).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => {
            onPick(value)
          }}
          className={`${PAD_BUTTON} w-9 text-gray-12`}
        >
          {formatValue(value)}
        </button>
      ))}
      {/* The two labels are easy to confuse, so the scope is spelled out for a screen reader. */}
      <button
        type="button"
        aria-label="Clear the selected cell"
        onClick={() => {
          onPick(EMPTY)
        }}
        className={`${PAD_BUTTON} px-3 text-gray-11`}
      >
        Clear
      </button>
      <button
        type="button"
        aria-label="Clear every cell"
        disabled={!hasValues}
        onClick={onClearAll}
        className={`${PAD_BUTTON} px-3 text-gray-11 disabled:opacity-40 disabled:hocus-visible:bg-transparent`}
      >
        Clear all
      </button>
    </div>
  )
}
