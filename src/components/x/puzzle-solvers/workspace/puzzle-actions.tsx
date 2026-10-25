import { useId } from 'react'
import type { ReactNode, RefObject } from 'react'

import { PendingButton } from '@/components/shared/pending-button'
import { Muted } from '@/components/shared/typography'
import { Button } from '@/components/ui/button'

type PuzzleActionsProps = {
  solveRef: RefObject<HTMLButtonElement | null>
  isSolved: boolean
  isSolving: boolean
  solveBlocker: string | undefined
  onSolve: () => void
  onBackToEditing: () => void
  canUndo: boolean
  onUndo: () => void
  onStartOver: () => void
}

export function PuzzleActions({
  solveRef,
  isSolved,
  isSolving,
  solveBlocker,
  onSolve,
  onBackToEditing,
  canUndo,
  onUndo,
  onStartOver,
}: PuzzleActionsProps): ReactNode {
  const blockerId = useId()
  const blocker = isSolved ? undefined : solveBlocker
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {/* One button for both, so focus stays on it when a solve lands or is put away. */}
        <PendingButton
          ref={solveRef}
          variant={isSolved ? 'outline' : 'default'}
          isPending={isSolving}
          pendingLabel="Solving…"
          disabled={blocker !== undefined}
          focusableWhenDisabled
          aria-describedby={blocker !== undefined ? blockerId : undefined}
          title={blocker}
          onClick={isSolved ? onBackToEditing : onSolve}
        >
          {isSolved ? 'Back to editing' : 'Solve'}
        </PendingButton>
        {/* Focusable while disabled, or undoing would drop focus from the button pressed. */}
        <Button variant="outline" disabled={!canUndo} focusableWhenDisabled onClick={onUndo}>
          Undo
        </Button>
        <Button variant="outline" onClick={onStartOver}>
          Start over
        </Button>
      </div>
      {/* Present while the puzzle is, so a new blocker is announced. */}
      <div role="status" className="text-center">
        {blocker !== undefined ? <Muted id={blockerId}>{blocker}</Muted> : undefined}
      </div>
    </>
  )
}
