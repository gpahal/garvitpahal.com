import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { colOf, indexOf, rowOf } from '@/lib/grid/geometry'
import { capitalize } from '@/lib/x/text'
import { SelectionMarker } from '@/components/x/ui/selection-marker'
import { useClickOutside } from '@/components/x/ui/use-click-outside'
import { useRovingFocus } from '@/components/x/ui/use-roving-focus'
import type { PuzzleEditorProps } from '@/puzzles/types'

import { ClueEditor, SizePad } from './cage-controls'
import {
  applyDraft,
  describeDraftIssue,
  draftIssue,
  setCageClue,
  startDraft,
  toggleDraftCell,
  type CageDraft,
} from './cage-edit'
import {
  cageBorderClasses,
  CageClue,
  cellTextClass,
  clueTextClass,
  describeCage,
  GridFrame,
} from './grid-view'
import { cageCellCount, cageIdAt, type Cage, type KenKenPuzzle } from './model'
import { describeCageIssue, findCageIssues } from './validate'

const ACTION_BUTTON =
  'unstyled inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium focus-visible:ring-anchor focus-visible:outline-none focus-visible:ring-2'

const PRIMARY_ACTION = `${ACTION_BUTTON} border-gray-12 bg-gray-12 text-gray-1 hocus-visible:bg-gray-12-hover`

const SECONDARY_ACTION = `${ACTION_BUTTON} border-gray-6 text-gray-12 hocus-visible:bg-gray-4`

/** How a cell reads and looks, which is the one thing the two modes disagree about. */
type CellState = {
  label: string
  fill: string
  /** Membership in the draft. Left unset outside cage-edit mode, where nothing is selectable. */
  isInDraft?: boolean
  isBlocked?: boolean
}

export function KenKenEditor({
  puzzle,
  onChange,
  onBlockerChange,
}: PuzzleEditorProps<KenKenPuzzle>): ReactNode {
  const { n } = puzzle.grid
  // Nothing is selected until the user picks a cell, including on first render: a grid that arrives
  // with a cell already outlined claims a choice the user has not made yet.
  const [selected, setSelected] = useState<number | undefined>(undefined)
  const [draft, setDraft] = useState<CageDraft | undefined>(undefined)
  const gridRef = useRovingFocus<HTMLDivElement>(selected)
  // Disabled while drafting: a half-built cage is unfinished work, and losing the cursor to a stray
  // press elsewhere on the page would take Done and Cancel with it. Those are the way out instead.
  const rootRef = useClickOutside<HTMLDivElement>(() => {
    setSelected(undefined)
  }, draft === undefined)

  // A draft is uncommitted, so the puzzle the workspace holds is the one from before it was opened.
  // Solving that would answer the shape on screen with the arithmetic of the shape it replaced.
  useEffect(() => {
    onBlockerChange(draft ? 'Finish or cancel the cage you are editing first' : undefined)
    return () => {
      onBlockerChange(undefined)
    }
  }, [draft, onBlockerChange])

  // The draft is previewed by committing it, so the borders, clues and `?` markers on screen are
  // exactly what Done produces - there is no second rendering path that could disagree with it.
  const preview = useMemo(() => (draft ? applyDraft(puzzle, draft) : puzzle), [puzzle, draft])
  const { grid } = preview

  const issues = useMemo(() => findCageIssues(grid), [grid])
  const unreviewedSet = useMemo(() => new Set(preview.unreviewedCages), [preview])
  const cellCounts = useMemo(() => grid.cages.map((_, id) => cageCellCount(grid, id)), [grid])

  const selectedCageId = selected === undefined ? undefined : cageIdAt(grid, selected)
  // `findCageIssues` leaves out a cage that merely has no clue yet, so this is only ever a real
  // problem - and the running count of those is the blocker's to report, not the editor's.
  const selectedIssue = selectedCageId === undefined ? undefined : issues.get(selectedCageId)

  // The clue is editable in both modes: reaching for a shape editor to fix a wrong number would be
  // the wrong tool, and setting it while shaping makes entering a cage by hand a single gesture.
  const clueCage = draft
    ? draft.cage
    : selectedCageId === undefined
      ? undefined
      : grid.cages[selectedCageId]

  function onClueChange(cage: Cage): void {
    if (draft) {
      setDraft({ ...draft, cage })
    } else if (selectedCageId !== undefined) {
      onChange(setCageClue(puzzle, selectedCageId, cage))
    }
  }

  const onCellClick = useCallback(
    (cell: number) => {
      // The cursor follows the click either way - a browser focuses whatever button was pressed, so
      // leaving it behind on a rejected cell would put the roving tabindex out of step with focus.
      setSelected(cell)
      if (!draft) {
        return
      }
      const cells = toggleDraftCell(n, draft.cells, cell)
      if (cells) {
        setDraft({ ...draft, cells })
      }
    },
    [draft, n],
  )

  // On the cells, not the grid: with a roving tabindex the focused element is a cell, and a handler
  // on a container that can never hold focus is one the keyboard only reaches by accident.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (selected === undefined) {
        return
      }

      const row = rowOf(n, selected)
      const col = colOf(n, selected)
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
        case 'Escape': {
          // Backs out of whichever is innermost, and is the keyboard's way to clear a selection
          // since a press on the page is what does it with a pointer. Space and Enter need nothing:
          // the cells are buttons, so both already run `onCellClick`.
          if (draft) {
            setDraft(undefined)
          } else {
            setSelected(undefined)
            event.currentTarget.blur()
          }
          break
        }
        default: {
          isHandled = false
        }
      }

      if (isHandled) {
        event.preventDefault()
      }
    },
    [draft, n, selected],
  )

  function cellState(cell: number): CellState {
    const cageId = cageIdAt(grid, cell)
    const position = `Row ${String(rowOf(n, cell) + 1)}, column ${String(colOf(n, cell) + 1)}`

    if (draft) {
      const isInDraft = draft.cells.has(cell)
      const issue = draftIssue(n, draft.cells, cell)
      return {
        label: `${position}, ${isInDraft ? 'in this cage' : 'not in this cage'}${
          issue ? `, ${describeDraftIssue(issue)}` : ''
        }`,
        // What can be clicked is highlighted rather than what cannot: the addable ring is a handful
        // of cells, so lighting it up says where to go instead of greying out most of the grid.
        fill: isInDraft
          ? `z-10 bg-gray-5 ${issue ? 'cursor-not-allowed' : ''}`
          : issue
            ? 'bg-bg cursor-not-allowed'
            : 'bg-gray-2 hocus-visible:bg-gray-4',
        isInDraft,
        isBlocked: issue !== undefined,
      }
    }

    const issue = issues.get(cageId)
    const isUnreviewed = unreviewedSet.has(cageId)
    return {
      label: `${position}, ${describeCage(grid, cell, cellCounts[cageId] ?? 1)}${
        isUnreviewed ? ', needs review' : ''
      }${issue ? `, ${describeCageIssue(issue)}` : ''}`,
      fill: issue
        ? 'z-10 bg-gray-5'
        : isUnreviewed
          ? 'z-10 bg-gray-4'
          : cageId === selectedCageId
            ? 'bg-gray-3'
            : 'bg-bg hocus-visible:bg-gray-3',
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      {/* Hidden while drafting: a resize clears every cage, which would take the draft with it. */}
      {draft ? undefined : (
        <SizePad
          puzzle={puzzle}
          onChange={(next) => {
            // A resize starts the cages over, so a selection kept across it would point into a
            // layout that no longer exists.
            setSelected(undefined)
            onChange(next)
          }}
        />
      )}

      <GridFrame
        ref={gridRef}
        n={n}
        label={`${String(n)} by ${String(n)} Ken Ken grid`}
        className="rounded-md"
        renderCell={(cell) => {
          const cageId = cageIdAt(grid, cell)
          const isSelected = cell === selected
          const { label, fill, isInDraft, isBlocked } = cellState(cell)
          // Suppressed while drafting: the shape in hand is the only thing worth looking at, and a
          // cage flagged by the model would otherwise outshout it in the same corner.
          const issue = draft ? undefined : issues.get(cageId)
          const isFlagged = !draft && (issue !== undefined || unreviewedSet.has(cageId))

          return (
            <button
              key={cell}
              type="button"
              role="gridcell"
              aria-rowindex={rowOf(n, cell) + 1}
              aria-colindex={colOf(n, cell) + 1}
              aria-label={label}
              aria-selected={isInDraft}
              // `aria-disabled`, not `disabled`: arrow keys still cross the cell and a screen reader
              // still reaches it, which is the only way to hear why it cannot be picked.
              aria-disabled={isBlocked}
              // Roving: only the selected cell is tabbable, so arrow keys move real focus and each
              // cell's label is announced as it is reached. With nothing selected the first cell
              // stands in, or Tab would have no way into the grid at all.
              tabIndex={isSelected || (selected === undefined && cell === 0) ? 0 : -1}
              onKeyDown={onKeyDown}
              // Selection follows focus, so tabbing in picks the cell up rather than leaving a
              // focused cell that the controls below say nothing about.
              onFocus={() => {
                setSelected(cell)
              }}
              onClick={() => {
                onCellClick(cell)
              }}
              className={[
                'unstyled relative flex aspect-square items-center justify-center',
                cellTextClass(n),
                cageBorderClasses(grid, cell),
                fill,
                // Raised so the marker below is not clipped by a neighbour's border.
                isSelected ? 'z-20' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isSelected ? <SelectionMarker /> : undefined}
              <CageClue
                grid={grid}
                cell={cell}
                hasPlaceholder
                className={isFlagged ? 'text-gray-12' : undefined}
              />
              {issue ? (
                <span
                  aria-hidden="true"
                  className={`absolute top-0.5 right-1 leading-none font-semibold text-gray-12 ${clueTextClass(n)}`}
                >
                  !
                </span>
              ) : undefined}
            </button>
          )
        }}
      />

      <div className="mx-auto flex max-w-md flex-col items-center gap-2">
        {/* One element across both modes, so entering and leaving cage-edit is a text change a live
            region announces rather than two paragraphs swapping silently. */}
        <p role="status" className="unstyled my-0! text-center text-sm text-gray-11">
          {draft
            ? 'Click cells to add or remove them from this cage'
            : selected === undefined
              ? 'Select a cell to edit its cage'
              : 'Edit cage reshapes the cage this cell is in'}
        </p>

        {/* Also one element across both modes, so a half-typed target survives the switch. */}
        {clueCage ? <ClueEditor n={n} cage={clueCage} onChange={onClueChange} /> : undefined}

        {draft ? (
          <div className="flex flex-wrap items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => {
                onChange(preview)
                setDraft(undefined)
              }}
              className={PRIMARY_ACTION}
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(undefined)
              }}
              className={SECONDARY_ACTION}
            >
              Cancel
            </button>
          </div>
        ) : selected === undefined ? undefined : (
          <button
            type="button"
            aria-label={`Edit the cage at row ${String(rowOf(n, selected) + 1)}, column ${String(colOf(n, selected) + 1)}`}
            onClick={() => {
              setDraft(startDraft(puzzle.grid, selected))
            }}
            className={SECONDARY_ACTION}
          >
            Edit cage
          </button>
        )}

        {/* The only complaint the editor makes, and only about the cell in hand: anything true of
            the grid as a whole is the solve blocker's to say, once, under the Solve button.

            Left out while drafting, where the shape is allowed to be mid-edit. */}
        {draft || !selectedIssue ? undefined : (
          <p role="alert" className="unstyled my-0! text-center text-sm text-gray-12">
            {capitalize(describeCageIssue(selectedIssue))}
          </p>
        )}
      </div>
    </div>
  )
}
