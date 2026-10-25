import { use, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { isFocusLost } from '@/lib/final-focus'
import { useDialogWork } from '@/hooks/use-dialog-work'
import { ErrorsRevealedContext } from '@/hooks/use-error-once-touched'
import type { Submit } from '@/hooks/use-submit'
import { FormNoticeContext } from '@/components/shared/dialog-contexts'
import { NoticeAlert } from '@/components/shared/notice-alert'
import { PendingButton } from '@/components/shared/pending-button'
import { ScrollDialogBody, ScrollDialogContent } from '@/components/shared/scroll-dialog'
import { DialogFooter } from '@/components/ui/dialog'

/**
 * Freezing the fields during a write drops focus from the one Enter was pressed in, so a failed
 * write hands it back unless it has moved since. Call the result as the write starts. `hasFailed`
 * must be false after a success.
 */
function useRefocusAfterFailure(isPending: boolean, hasFailed: boolean): () => void {
  const focusedAtSubmitRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const focused = focusedAtSubmitRef.current
    if (isPending || focused === null) {
      return
    }
    focusedAtSubmitRef.current = null
    if (hasFailed && focused.isConnected && isFocusLost(focused)) {
      focused.focus()
    }
  }, [isPending, hasFailed])
  return useCallback(() => {
    focusedAtSubmitRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
  }, [])
}

type FormDialogRowsProps = {
  submit: Submit
  /**
   * Blocks the save. Every error shows beside its field, so a blocked Save reveals them all.
   */
  isInvalid: boolean
  isDirty: boolean
  leading?: ReactNode
  footer?: ReactNode
  submitLabel?: string
  /**
   * The id of a message about the whole form, which no single field owns.
   */
  submitDescribedBy?: string
  pendingLabel?: string
  onSubmit: () => void
  children: ReactNode
}

/**
 * The body and footer of a form dialog, so a dialog whose header loads keeps one popup rather than
 * remounting. Save stays enabled while invalid, since a disabled button cannot say why; pressing it
 * focuses the first invalid input or `data-blocks-save` control.
 */
export function FormDialogRows({
  submit,
  isInvalid,
  isDirty,
  leading,
  footer,
  submitLabel = 'Save',
  submitDescribedBy,
  pendingLabel = 'Saving…',
  onSubmit,
  children,
}: FormDialogRowsProps): ReactNode {
  useDialogWork(isDirty, submit.isPending)
  const notice = use(FormNoticeContext)
  const formRef = useRef<HTMLFormElement | null>(null)
  const [blockedSaves, setBlockedSaves] = useState(0)
  useEffect(() => {
    if (blockedSaves > 0) {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"], [data-blocks-save="true"]')
        ?.focus()
    }
  }, [blockedSaves])
  const noteFocus = useRefocusAfterFailure(submit.isPending, submit.failure !== undefined)
  return (
    // `contents` puts the body and footer in the dialog's grid rows. Native validation only blocks
    // behind a tooltip and cannot express the form's own rules.
    <form
      ref={formRef}
      noValidate
      className="contents"
      onSubmit={(event) => {
        event.preventDefault()
        // Enter submits even with the footer replaced, when there is no Save to stand for.
        if (footer !== undefined || submit.isPending) {
          return
        }
        if (isInvalid) {
          setBlockedSaves((count) => count + 1)
          return
        }
        noteFocus()
        onSubmit()
      }}
    >
      <ScrollDialogBody submit={submit}>
        {notice === undefined ? undefined : <NoticeAlert message={notice} tone="warning" />}
        <fieldset disabled={submit.isPending} className="flex min-w-0 flex-col gap-5">
          <ErrorsRevealedContext value={blockedSaves > 0}>{children}</ErrorsRevealedContext>
        </fieldset>
      </ScrollDialogBody>
      {footer ?? (
        <DialogFooter>
          {leading}
          <PendingButton
            type="submit"
            isPending={submit.isPending}
            pendingLabel={pendingLabel}
            aria-describedby={submitDescribedBy}
          >
            {submitLabel}
          </PendingButton>
        </DialogFooter>
      )}
    </form>
  )
}

export function FormDialogContent({
  title,
  description,
  ...rows
}: FormDialogRowsProps & { title: string; description?: string }): ReactNode {
  return (
    <ScrollDialogContent title={title} description={description}>
      <FormDialogRows {...rows} />
    </ScrollDialogContent>
  )
}
