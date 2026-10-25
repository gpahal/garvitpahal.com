import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import type { Submit } from '@/hooks/use-submit'
import { SubmitButton } from '@/components/shared/pending-button'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'

type ConfirmDeleteOptions = {
  question: string
  submit: Submit
  remove: () => Promise<unknown>
  onDeleted: () => void
}

export type ConfirmDelete = {
  button: ReactNode
  footer: ReactNode
}

/**
 * Deleting has no undo, so it takes a second tap, which runs `remove` through `submit` as
 * `deleting`.
 */
export function useConfirmDelete({
  question,
  submit,
  remove,
  onDeleted,
}: ConfirmDeleteOptions): ConfirmDelete {
  // `undefined` until the first tap, so opening the dialog does not pull focus to Delete.
  const [isAsking, setIsAsking] = useState<boolean>()
  const firstTapRef = useRef<HTMLButtonElement | null>(null)
  const keepRef = useRef<HTMLButtonElement | null>(null)
  const questionId = useId()

  // Either tap swaps the footer, unmounting the focused button. Asking lands on Keep, so a second
  // Enter cannot delete.
  useEffect(() => {
    if (isAsking === undefined) {
      return
    }
    const target = isAsking ? keepRef.current : firstTapRef.current
    target?.focus()
  }, [isAsking])

  return {
    button: (
      <Button
        ref={firstTapRef}
        variant="destructive"
        className="sm:mr-auto"
        disabled={submit.isPending}
        onClick={() => {
          setIsAsking(true)
        }}
      >
        Delete
      </Button>
    ),
    footer: isAsking ? (
      <DialogFooter>
        <p id={questionId} className="self-center text-muted-foreground sm:mr-auto">
          {question}
        </p>
        <Button
          ref={keepRef}
          variant="outline"
          aria-describedby={questionId}
          disabled={submit.isPending}
          onClick={() => {
            setIsAsking(false)
          }}
        >
          Keep
        </Button>
        <SubmitButton
          variant="destructive"
          aria-describedby={questionId}
          submit={submit}
          doing="deleting"
          action={remove}
          onSuccess={onDeleted}
        >
          Delete
        </SubmitButton>
      </DialogFooter>
    ) : undefined,
  }
}
