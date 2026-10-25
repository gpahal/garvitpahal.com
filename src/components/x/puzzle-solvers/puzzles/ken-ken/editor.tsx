import { useEffect, useId, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { cn } from 'cn'

import { capitalize } from '@/lib/text'
import { describeCell, speakGridSize } from '@/lib/x/puzzle-solvers/grid/geometry'
import {
  applyDraft,
  describeDraftIssue,
  draftIssue,
  isDraftUnchanged,
  setCageClue,
  startDraft,
  toggleDraftCell,
  withDraftCells,
} from '@/lib/x/puzzle-solvers/puzzles/ken-ken/cage-edit'
import type { CageDraft } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/cage-edit'
import {
  cageIdAt,
  cellsByCage,
  clueCells,
  createPuzzle,
  describeCage,
  isBlankGrid,
  KEN_KEN_SIZES,
} from '@/lib/x/puzzle-solvers/puzzles/ken-ken/model'
import type { Cage, KenKenPuzzle } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/model'
import { describeCageIssue, findCageIssues } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/validate'
import type { MarkedCageIssue } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/validate'
import { Muted } from '@/components/shared/typography'
import { Button } from '@/components/ui/button'

import { EditorCell } from '../../grid/editor-cell'
import { GridFrame } from '../../grid/grid-frame'
import { IssueMarker } from '../../grid/issue-marker'
import { SizeToggle } from '../../grid/size-toggle'
import { useGridSelection } from '../../grid/use-grid-selection'
import type { PuzzleEditorProps } from '../puzzle-ui'
import { ClueEditor } from './clue-editor'
import { cageBorderClasses, cellTextClass, clueTextClass } from './grid-classes'
import { CageClue } from './grid-view'

type CellState = {
  label: string
  fill: string
  /**
   * Unset outside cage-edit mode.
   */
  isInDraft?: boolean
  isBlocked?: boolean
  /**
   * Both unset while drafting, or a flagged cage would outshout the shape in hand.
   */
  issue?: MarkedCageIssue
  isFlagged?: boolean
}

export function KenKenEditor({
  puzzle,
  onChange,
  onBlockerChange,
}: PuzzleEditorProps<KenKenPuzzle>): ReactNode {
  const { n } = puzzle.grid
  const issueId = useId()
  const [draft, setDraft] = useState<CageDraft>()
  const [cluePass, setCluePass] = useState(0)
  // While drafting, only Done and Cancel clear the cursor.
  const {
    selected,
    setSelected,
    gridRef,
    rootRef,
    cellProps,
    moveOnNavigationKey,
    deselect,
    focusSelected,
  } = useGridSelection(n, draft === undefined)

  // The workspace holds the puzzle from before the draft, so solving now would answer the wrong
  // one.
  const isDrafting = draft !== undefined
  useEffect(() => {
    onBlockerChange(isDrafting ? 'Finish or cancel the cage you are editing first' : undefined)
    return () => {
      onBlockerChange(undefined)
    }
  }, [isDrafting, onBlockerChange])

  const preview = draft ? applyDraft(puzzle, draft) : puzzle
  const { grid } = preview

  const issues = findCageIssues(grid)
  const unreviewedSet = new Set(preview.unreviewedCages)
  const byCage = cellsByCage(grid)
  const anchors = clueCells(byCage)

  const selectedCageId = selected === undefined ? undefined : cageIdAt(grid, selected)
  const selectedIssue = selectedCageId === undefined ? undefined : issues.get(selectedCageId)

  const clueCage = draft
    ? draft.cage
    : selectedCageId === undefined
      ? undefined
      : grid.cages[selectedCageId]
  // The origin id while drafting, since toggling cells moves the preview's anchor and so its id.
  const subjectCageId = draft ? draft.originCageId : selectedCageId
  // Keys the clue field. Compaction can hand a cage id to another cage after a shape edit, so the
  // pass counter marks the edit the id would hide.
  const subject = `${String(cluePass)}/${String(subjectCageId)}`

  function endDraft(): void {
    setDraft(undefined)
    setCluePass((pass) => pass + 1)
  }

  function onClueChange(cage: Cage, isContinuingEdit: boolean): void {
    if (draft) {
      setDraft({ ...draft, cage })
    } else if (selectedCageId !== undefined) {
      onChange(setCageClue(puzzle, selectedCageId, cage), isContinuingEdit)
    }
  }

  const onCellClick = (cell: number): void => {
    // Even a rejected click moves the cursor, to stay in step with browser focus.
    setSelected(cell)
    if (!draft) {
      return
    }
    const cells = toggleDraftCell(n, draft.cells, cell)
    if (cells) {
      setDraft(withDraftCells(draft, cells))
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (moveOnNavigationKey(event) || event.key !== 'Escape') {
      return
    }
    if (draft) {
      endDraft()
    } else {
      deselect(event)
    }
    event.preventDefault()
  }

  function cellState(cell: number): CellState {
    const cageId = cageIdAt(grid, cell)
    const position = describeCell(n, cell)

    if (draft) {
      const isInDraft = draft.cells.has(cell)
      const issue = draftIssue(n, draft.cells, cell)
      return {
        label: `${position}, ${isInDraft ? 'in this cage' : 'not in this cage'}${
          issue ? `, ${describeDraftIssue(issue)}` : ''
        }`,
        // Foreground tints, because `muted` is as light as the draft in dark mode.
        fill: isInDraft
          ? `z-10 bg-foreground/15 ${issue ? 'cursor-not-allowed' : ''}`
          : issue
            ? 'bg-background cursor-not-allowed'
            : 'bg-foreground/5 hover:bg-foreground/10',
        isInDraft,
        isBlocked: issue !== undefined,
      }
    }

    const issue = issues.get(cageId)
    const isUnreviewed = unreviewedSet.has(cageId)
    return {
      label: `${position}, ${describeCage(grid, cell, byCage[cageId]?.length ?? 1)}${
        isUnreviewed ? ', needs review' : ''
      }${issue ? `, ${describeCageIssue(issue)}` : ''}`,
      fill: issue
        ? 'z-10 bg-destructive/10'
        : isUnreviewed
          ? 'z-10 bg-foreground/5'
          : cageId === selectedCageId
            ? 'bg-muted'
            : 'bg-background hover:bg-muted',
      issue,
      isFlagged: issue !== undefined || isUnreviewed,
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      {/* Hidden while drafting, since a resize clears every cage, the draft included. */}
      {draft ? undefined : (
        <div className="flex flex-col items-center gap-1">
          <SizeToggle
            sizes={KEN_KEN_SIZES.list}
            n={n}
            isDestructive={() => !isBlankGrid(puzzle.grid)}
            body="Changing the size clears every cage and clue. Undo brings them back"
            onPick={(size) => {
              onChange(createPuzzle(size))
            }}
            className="max-w-md"
          />
          <Muted className="text-center">Changing the size clears every cage</Muted>
        </div>
      )}

      <GridFrame
        role="grid"
        ref={gridRef}
        n={n}
        label={`${speakGridSize(n)} Ken Ken grid`}
        isMultiselectable={isDrafting}
        className="rounded-md"
        renderCell={(cell) => {
          const isSelected = cell === selected
          const { label, fill, isInDraft, isBlocked, issue, isFlagged } = cellState(cell)

          return (
            <EditorCell
              key={cell}
              isSelected={isSelected}
              {...cellProps(cell)}
              aria-label={label}
              aria-selected={isInDraft}
              // Reachable, so a reader can hear why it is refused.
              aria-disabled={isBlocked}
              onKeyDown={onKeyDown}
              onClick={() => {
                onCellClick(cell)
              }}
              className={cn(
                'focus-visible:ring-3 focus-visible:ring-ring/50',
                cellTextClass(n),
                cageBorderClasses(grid, cell),
                fill,
              )}
            >
              <CageClue
                grid={grid}
                cell={cell}
                isAnchor={anchors.has(cell)}
                hasPlaceholder
                className={isFlagged ? 'text-foreground' : undefined}
              />
              {issue ? (
                <IssueMarker className={cn('top-0.5 right-1 font-semibold', clueTextClass(n))} />
              ) : undefined}
            </EditorCell>
          )
        }}
      />

      <div className="mx-auto flex max-w-md flex-col items-center gap-2">
        <Muted role="status" className="text-center">
          {draft
            ? 'Select cells to add or remove them from this cage'
            : selected === undefined
              ? 'Select a cell to edit its cage'
              : 'Press Edit cage to change which cells are in this cage'}
        </Muted>

        {/* A half-typed target survives entering cage-edit and nothing else. */}
        {clueCage ? (
          <ClueEditor
            key={subject}
            n={n}
            cage={clueCage}
            issue={draft ? undefined : selectedIssue}
            issueId={issueId}
            isUnreviewed={
              !draft && selectedCageId !== undefined && unreviewedSet.has(selectedCageId)
            }
            onChange={onClueChange}
          />
        ) : undefined}

        {draft ? (
          <div className="flex flex-wrap items-center justify-center gap-1">
            {/* These unmount when pressed, so focus goes back to the cell. */}
            <Button
              onClick={() => {
                if (!isDraftUnchanged(puzzle, draft)) onChange(preview)
                endDraft()
                focusSelected()
              }}
            >
              Done
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                endDraft()
                focusSelected()
              }}
            >
              Cancel
            </Button>
          </div>
        ) : selected === undefined ? undefined : (
          <Button
            variant="outline"
            aria-label={`Edit cage at ${describeCell(n, selected).toLowerCase()}`}
            onClick={() => {
              setDraft(startDraft(puzzle.grid, selected))
              focusSelected()
            }}
          >
            Edit cage
          </Button>
        )}

        {/*
         * Not live: it would speak on every cursor move, and the cell's label already carries it.
         */}
        {draft || !selectedIssue ? undefined : (
          <p id={issueId} className="text-center text-sm">
            {capitalize(describeCageIssue(selectedIssue))}
          </p>
        )}
      </div>
    </div>
  )
}
