import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { cn } from 'cn'

import {
  colOf,
  describeCell,
  indexOf,
  rowOf,
  speakGridSize,
} from '@/lib/x/puzzle-solvers/grid/geometry'
import {
  readKeyboardEntry,
  readTwoDigitWindowEnd,
  TWO_DIGIT_WINDOW_MS,
} from '@/lib/x/puzzle-solvers/puzzles/sudoku/keyboard-entry'
import type { PendingTens } from '@/lib/x/puzzle-solvers/puzzles/sudoku/keyboard-entry'
import {
  cloneGrid,
  defaultBoxGeometry,
  EMPTY,
  findConflicts,
  formatValue,
  resizeGrid,
  SUDOKU_SIZES,
  willResizeDropValues,
} from '@/lib/x/puzzle-solvers/puzzles/sudoku/model'
import type { SudokuGrid, SudokuPuzzle } from '@/lib/x/puzzle-solvers/puzzles/sudoku/model'
import { Muted } from '@/components/shared/typography'
import { Button } from '@/components/ui/button'

import { EditorCell } from '../../grid/editor-cell'
import { GridFrame } from '../../grid/grid-frame'
import { IssueMarker } from '../../grid/issue-marker'
import { SizeToggle } from '../../grid/size-toggle'
import { useGridSelection } from '../../grid/use-grid-selection'
import type { PuzzleEditorProps } from '../puzzle-ui'
import { cellBorderClasses, cellTextClass } from './grid-view'

export function SudokuEditor({ puzzle, onChange }: PuzzleEditorProps<SudokuPuzzle>): ReactNode {
  const { grid, uncertain } = puzzle
  const { n, boxWidth, boxHeight } = grid
  const {
    selected,
    setSelected,
    gridRef,
    rootRef,
    cellProps,
    moveOnNavigationKey,
    deselect,
    focusSelected,
  } = useGridSelection(n)

  const conflicts = new Set(findConflicts(grid))
  const uncertainSet = new Set(uncertain.map((cell) => indexOf(n, cell.row, cell.col)))

  // Retyping a value is no edit unless it clears a flag.
  const isUnchanged = (cell: number, value: number): boolean =>
    grid.values[cell] === value && !uncertainSet.has(cell)

  // `isContinuingEdit` marks the second digit of a two-digit value.
  const setValue = (cell: number, value: number, isContinuingEdit = false): void => {
    if (isUnchanged(cell, value)) return
    const next = cloneGrid(grid)
    next.values[cell] = value
    onChange(
      {
        ...puzzle,
        grid: next,
        uncertain: uncertain.filter((ref) => indexOf(n, ref.row, ref.col) !== cell),
      },
      isContinuingEdit,
    )
  }

  // A typed 1 that a second digit may extend to 10-16, joining its edit for undo. Keys such as
  // Shift leave the window open (`readTwoDigitWindowEnd`).
  const pendingRef = useRef<{ tens: PendingTens; isCommitted: boolean } | undefined>(undefined)
  // A focused cell's changed name is not reliably read out, and a 1 that may become 12 waits out
  // the window rather than being read twice.
  const [announcement, setAnnouncement] = useState('')
  const announceTimerRef = useRef<{ id: ReturnType<typeof setTimeout>; text: string } | undefined>(
    undefined,
  )
  useEffect(() => () => clearTimeout(announceTimerRef.current?.id), [])
  const announce = (text: string, delayMs: number): void => {
    clearTimeout(announceTimerRef.current?.id)
    const id = setTimeout(() => {
      announceTimerRef.current = undefined
      setAnnouncement(text)
    }, delayMs)
    announceTimerRef.current = { id, text }
  }
  // A delayed announcement would name a value these have replaced, so it is dropped.
  const endTwoDigitWindow = (): void => {
    pendingRef.current = undefined
    clearTimeout(announceTimerRef.current?.id)
    announceTimerRef.current = undefined
  }
  // Reads the value out now, before focus moves on to another cell.
  const finishTwoDigitWindow = (): void => {
    const held = announceTimerRef.current?.text
    endTwoDigitWindow()
    if (held !== undefined) setAnnouncement(held)
  }

  // Clones rather than rebuilding from the size, which would lose which way non-square boxes lie.
  const clearAll = (): void => {
    const next = cloneGrid(grid)
    next.values.fill(EMPTY)
    onChange({ ...puzzle, grid: next, uncertain: [] })
  }

  const hasValues = grid.values.some((value) => value !== EMPTY)

  const resize = (next: SudokuGrid): void => {
    endTwoDigitWindow()
    // A resize keeps the top-left block in place, so flags still inside still point at their cells.
    onChange({
      grid: next,
      uncertain: uncertain.filter((ref) => ref.row < next.n && ref.col < next.n),
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const pending = pendingRef.current
    const windowEnd = readTwoDigitWindowEnd(event)
    if (windowEnd === 'finish') finishTwoDigitWindow()
    else if (windowEnd === 'entry') endTwoDigitWindow()
    if (selected === undefined || moveOnNavigationKey(event)) {
      return
    }

    switch (event.key) {
      case 'Backspace':
      case 'Delete': {
        setValue(selected, EMPTY)
        announce(`${describeCell(n, selected)}, empty`, 0)
        break
      }
      case 'Escape': {
        deselect(event)
        break
      }
      default: {
        const entry = readKeyboardEntry(event.key, n, selected, pending?.tens, performance.now())
        if (entry === undefined) {
          return
        }
        const isCommitted = !isUnchanged(selected, entry.value)
        setValue(selected, entry.value, entry.isSecondDigit && pending?.isCommitted === true)
        if (entry.pending) pendingRef.current = { tens: entry.pending, isCommitted }
        announce(
          `${describeCell(n, selected)}, ${entry.value === EMPTY ? 'empty' : formatValue(entry.value)}`,
          entry.pending ? TWO_DIGIT_WINDOW_MS : 0,
        )
      }
    }
    event.preventDefault()
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-1">
        <SizeToggle
          sizes={SUDOKU_SIZES.list}
          n={n}
          isDestructive={(size) => willResizeDropValues(grid, size)}
          body="Changing the size clears every value that does not fit. Undo brings them back"
          onPick={(size) => {
            const geometry = defaultBoxGeometry(size)
            resize(resizeGrid(grid, size, geometry.boxWidth, geometry.boxHeight))
          }}
        />

        {/* A 6x6 with 3x2 boxes and one with 2x3 boxes are different puzzles. */}
        {boxWidth === boxHeight ? undefined : (
          <Button
            variant="outline"
            size="sm"
            aria-label={`Boxes ${String(boxWidth)}×${String(boxHeight)}: ${String(boxWidth)} wide by ${String(boxHeight)} tall. Switch to ${String(boxHeight)} by ${String(boxWidth)}`}
            onClick={() => {
              resize(resizeGrid(grid, n, boxHeight, boxWidth))
            }}
          >
            Boxes {boxWidth}×{boxHeight}
          </Button>
        )}
      </div>

      <GridFrame
        role="grid"
        ref={gridRef}
        n={n}
        label={`${speakGridSize(n)} Sudoku grid`}
        className="rounded-md"
        renderCell={(cell) => {
          const row = rowOf(n, cell)
          const col = colOf(n, cell)
          const value = grid.values[cell] ?? EMPTY
          const isSelected = cell === selected
          const isConflict = conflicts.has(cell)
          const isUncertain = uncertainSet.has(cell)

          return (
            <EditorCell
              key={cell}
              isSelected={isSelected}
              {...cellProps(cell)}
              aria-label={`${describeCell(n, cell)}${
                value === EMPTY ? ', empty' : `, ${formatValue(value)}`
              }${isUncertain ? ', needs review' : ''}${isConflict ? ', conflicts' : ''}`}
              onKeyDown={onKeyDown}
              onClick={() => {
                endTwoDigitWindow()
                setSelected(cell)
              }}
              className={cn(
                'font-semibold text-foreground',
                cellTextClass(n),
                cellBorderClasses(grid, row, col),
                // A focus ring would replace a flag's ring; the selection marker still shows focus.
                isConflict
                  ? 'z-10 bg-destructive/10 ring-2 ring-destructive'
                  : isUncertain
                    ? 'z-10 bg-foreground/5 ring-1 ring-ring'
                    : 'bg-background hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
              )}
            >
              <span className={isUncertain ? 'underline decoration-dotted underline-offset-4' : ''}>
                {formatValue(value)}
              </span>
              {isConflict ? <IssueMarker className="top-0 right-0.5 text-[0.6rem]" /> : undefined}
            </EditorCell>
          )
        }}
      />

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {/* Stays mounted so the hint is announced when it returns. */}
      <div role="status" className="empty:hidden">
        {selected === undefined ? (
          <Muted className="text-center">Select a cell to enter a value</Muted>
        ) : undefined}
      </div>
      {selected === undefined ? undefined : (
        <ValuePad
          n={n}
          // Focus goes back to the cell, where the keyboard works; Clear all disables itself,
          // which would drop focus to the page.
          onPick={(value) => {
            endTwoDigitWindow()
            setValue(selected, value)
            focusSelected()
          }}
          onClearAll={() => {
            endTwoDigitWindow()
            clearAll()
            focusSelected()
          }}
          hasValues={hasValues}
        />
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
    <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-1">
      {Array.from({ length: n }, (_, index) => index + 1).map((value) => (
        <Button
          key={value}
          variant="outline"
          size="icon"
          onClick={() => {
            onPick(value)
          }}
        >
          {formatValue(value)}
        </Button>
      ))}
      {/* The two labels are easy to confuse, so the scope is spelled out. */}
      <Button
        variant="outline"
        size="sm"
        aria-label="Clear the selected cell"
        onClick={() => {
          onPick(EMPTY)
        }}
      >
        Clear
      </Button>
      <Button
        variant="outline"
        size="sm"
        aria-label="Clear all cells"
        disabled={!hasValues}
        onClick={onClearAll}
      >
        Clear all
      </Button>
    </div>
  )
}
