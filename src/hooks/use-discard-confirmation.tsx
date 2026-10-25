import { useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useStandIn } from '@/hooks/use-stand-in'
import { ScrollDialog, ScrollDialogBody } from '@/components/shared/scroll-dialog'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'

export type Question = { title: string; body: string; confirm: string }

type Decision = {
  question: Question
  action: () => void
  /**
   * For an action that removes or disables the control that asked. No element keeps the dialog's
   * default.
   */
  focusAfter?: () => HTMLElement | null | undefined
}

export function useDiscardConfirmation(): {
  ask: (
    isNeeded: boolean,
    question: Question,
    action: () => void,
    focusAfter?: Decision['focusAfter'],
  ) => void
  clear: () => void
  dialog: ReactNode
} {
  const [decision, setDecision] = useState<Decision>()
  // The last question stays worded while its dialog animates out.
  const last = useStandIn(decision, undefined)
  const shown = last?.question
  const keepRef = useRef<HTMLButtonElement | null>(null)
  const isConfirmedRef = useRef(false)
  const clear = (): void => setDecision(undefined)
  const ask = (
    isNeeded: boolean,
    question: Question,
    action: () => void,
    focusAfter?: Decision['focusAfter'],
  ): void => {
    if (isNeeded) {
      isConfirmedRef.current = false
      setDecision({ question, action, focusAfter })
    } else {
      action()
    }
  }
  const focusAfter = last?.focusAfter
  return {
    ask,
    clear,
    dialog: (
      <ScrollDialog
        isOpen={decision !== undefined}
        onClose={clear}
        title={shown?.title ?? ''}
        initialFocus={keepRef}
        // Unset without `focusAfter`: a function would make Base UI return focus even where it moved
        // on.
        finalFocus={
          focusAfter ? () => (isConfirmedRef.current ? focusAfter() : undefined) ?? true : undefined
        }
      >
        <ScrollDialogBody>{shown?.body}</ScrollDialogBody>
        <DialogFooter>
          <Button ref={keepRef} variant="outline" onClick={clear}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              const action = decision?.action
              isConfirmedRef.current = true
              clear()
              action?.()
            }}
          >
            {shown?.confirm}
          </Button>
        </DialogFooter>
      </ScrollDialog>
    ),
  }
}
