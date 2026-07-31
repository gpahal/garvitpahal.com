import { useCallback, useMemo, useState, type ReactNode } from 'react'

import type { CellRef } from '@/puzzles/types'

import {
  cloneGrid,
  defaultBoxGeometry,
  EMPTY,
  findConflicts,
  formatValue,
  indexOf,
  parseKeyboardValue,
  resizeGrid,
  SUDOKU_SIZES,
  type SudokuGrid,
} from './model'

const PAD_BUTTON =
  'unstyled border-gray-6 hocus-visible:bg-gray-4 focus-visible:ring-anchor inline-flex h-9 items-center justify-center rounded-md border text-sm font-medium focus-visible:ring-2 focus-visible:outline-none'

type SudokuEditorProps = {
  grid: SudokuGrid
  uncertain: Array<CellRef>
  onChange: (grid: SudokuGrid) => void
}

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

export function SudokuEditor({ grid, uncertain, onChange }: SudokuEditorProps): ReactNode {
  const { n } = grid
  const [selected, setSelected] = useState(0)

  const conflicts = useMemo(() => new Set(findConflicts(grid)), [grid])
  const uncertainSet = useMemo(
    () => new Set(uncertain.map((cell) => indexOf(n, cell.row, cell.col))),
    [uncertain, n],
  )

  const setValue = useCallback(
    (cell: number, value: number) => {
      const next = cloneGrid(grid)
      next.values[cell] = value
      onChange(next)
    },
    [grid, onChange],
  )

  // Clones rather than rebuilding from the size, so a non-rectangular region map would survive.
  const clearAll = useCallback(() => {
    const next = cloneGrid(grid)
    next.values.fill(EMPTY)
    onChange(next)
  }, [grid, onChange])

  const hasValues = useMemo(() => grid.values.some((value) => value !== EMPTY), [grid])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
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
    <div className="flex flex-col gap-3">
      <SizePad grid={grid} onChange={onChange} />

      <div
        role="grid"
        aria-label={`${String(n)} by ${String(n)} Sudoku grid`}
        aria-rowcount={n}
        aria-colcount={n}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="mx-auto grid w-full max-w-md rounded-md focus-visible:ring-2 focus-visible:ring-anchor focus-visible:outline-none"
        style={{ gridTemplateColumns: `repeat(${String(n)}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: n * n }, (_, cell) => {
          const row = Math.floor(cell / n)
          const col = cell % n
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
              tabIndex={-1}
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
                // Inset, not a `ring`: a ring draws outwards and spills past the grid's border.
                isSelected ? 'z-20 outline-[3px] -outline-offset-[3px] outline-anchor' : '',
                'text-gray-12',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className={isUncertain ? 'underline decoration-dotted underline-offset-4' : ''}>
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

      <ValuePad
        n={n}
        onPick={(value) => {
          setValue(selected, value)
        }}
        onClearAll={clearAll}
        hasValues={hasValues}
      />
    </div>
  )
}

/** Size lives with the editor because changing it is almost always a correction. */
function SizePad({
  grid,
  onChange,
}: {
  grid: SudokuGrid
  onChange: (grid: SudokuGrid) => void
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
            onChange(resizeGrid(grid, size, geometry.boxWidth, geometry.boxHeight))
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
            onChange(resizeGrid(grid, n, boxHeight, boxWidth))
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
