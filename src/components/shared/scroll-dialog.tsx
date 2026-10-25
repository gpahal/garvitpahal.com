import { use, useEffect, useRef } from 'react'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from 'cn'

import type { Failure } from '@/lib/failure'
import { DialogScopeContext } from '@/hooks/use-dialog-work'
import { useHasWaited } from '@/hooks/use-has-waited'
import type { Submit } from '@/hooks/use-submit'
import {
  DialogErrorsContext,
  DialogNoticeContext,
  DialogReadFailureContext,
} from '@/components/shared/dialog-contexts'
import type { DialogReadFailure } from '@/components/shared/dialog-contexts'
import { ErrorBoundary } from '@/components/shared/error-boundary'
import { NoticeAlert } from '@/components/shared/notice-alert'
import { focusDialogOnRemoval, focusEnclosingDialog } from '@/components/shared/refocus-on-removal'
import { remedyActions } from '@/components/shared/remedy-actions'
import { Muted } from '@/components/shared/typography'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type DialogContentProps = ComponentProps<typeof DialogContent>

type ScrollDialogContentProps = {
  title: string
  description?: ReactNode
  /**
   * Base UI otherwise focuses the first tabbable element rather than the dialog's main action.
   */
  initialFocus?: DialogContentProps['initialFocus']
  /**
   * For when the opener may be gone or disabled by closing. Overrides `useDialogTarget`'s.
   */
  finalFocus?: DialogContentProps['finalFocus']
  children: ReactNode
}

/**
 * A dialog with a fixed header over a body and optional footer. The body must shrink to fit a
 * phone: `ScrollDialogBody`, or anything with `overflow-y-auto` or `min-h-0` that fills its row.
 * Under a `DialogErrorsContext`, what the children throw, or a read failure handed to
 * `DialogReadFailureContext`, shows under the header.
 */
export function ScrollDialogContent({
  title,
  description,
  initialFocus,
  finalFocus,
  children,
}: ScrollDialogContentProps): ReactNode {
  const scope = use(DialogScopeContext)
  const failureOf = use(DialogErrorsContext)
  const readFailure = use(DialogReadFailureContext)
  // Without the words for a notice, a failed read is thrown to whatever boundary holds the dialog.
  const readNotice = readFailure && failureOf && (
    <ReadFailureNotice hasResult={readFailure.hasResult} failure={failureOf(readFailure.error)} />
  )
  const isNoticeAbove = readNotice !== undefined && readFailure?.hasResult === true
  const body =
    readFailure === undefined || isNoticeAbove
      ? children
      : (readNotice ?? <Rethrow error={readFailure.error} />)
  return (
    <DialogContent
      initialFocus={initialFocus}
      finalFocus={finalFocus ?? scope?.finalFocus}
      className={cn(
        // With no padding here, a footer has none to bleed into, so its negative margins go. Over an
        // empty body the header drops its rule, which would double the footer's.
        'max-h-[calc(100dvh-2rem)] gap-0 p-0 **:data-[slot=dialog-footer]:m-0 sm:max-h-[80dvh] sm:max-w-lg [&:has(>[data-slot=dialog-body]:empty)>[data-slot=dialog-header]]:border-b-0',
        // A read's notice takes a row of its own, so the body keeps the one that shrinks.
        isNoticeAbove ? 'grid-rows-[auto_auto_1fr_auto]' : 'grid-rows-[auto_1fr_auto]',
      )}
    >
      <DialogHeader className="border-b p-4">
        <DialogTitle className="pr-8 leading-snug">{title}</DialogTitle>
        {description === undefined ? undefined : (
          <DialogDescription>{description}</DialogDescription>
        )}
      </DialogHeader>
      {isNoticeAbove ? readNotice : undefined}
      {failureOf === undefined ? (
        body
      ) : (
        <ErrorBoundary
          failureOf={failureOf}
          // Takes focus from Try again, which goes as the content comes back.
          onTryAgain={focusEnclosingDialog}
          leadingAction={CLOSE_BUTTON}
          className="p-4"
        >
          {body}
        </ErrorBoundary>
      )}
    </DialogContent>
  )
}

const CLOSE_BUTTON = <DialogClose render={<Button variant="outline" />}>Close</DialogClose>

/**
 * Sits above content kept on its last result, or replaces a body that never had one. It goes when
 * the read recovers, as after a renewed sign-in, so focus inside moves to the dialog.
 */
function ReadFailureNotice({
  failure,
  hasResult,
}: Pick<DialogReadFailure, 'hasResult'> & { failure: Failure }): ReactNode {
  return (
    <div ref={focusDialogOnRemoval} className={hasResult ? 'px-4 pt-4' : 'p-4'}>
      <NoticeAlert
        message={failure.message}
        action={remedyActions(failure, undefined, hasResult ? undefined : CLOSE_BUTTON)}
      />
    </div>
  )
}

function Rethrow({ error }: { error: Error }): never {
  throw error
}

/**
 * Longer than any write over a working connection, and well short of the time the client takes to
 * notice a dead socket, which the connectivity notice waits for.
 */
const SLOW_WRITE_MS = 10_000

const SLOW_WRITE =
  'This is taking a while. The connection may be slow. The change goes through once it can'

type ScrollDialogBodyProps = {
  submit?: Submit
  /**
   * Shows the `DialogNoticeContext`'s notice, by default only with a `submit`. Set it for a body
   * such as a list, which an outage would otherwise leave blank.
   */
  showsNotice?: boolean
  children?: ReactNode
}

/**
 * The scrolling row of a `ScrollDialogContent`. Given a `submit`, it shows the submit's error with
 * its remedy and says when the write is slow. Empty, it takes no room.
 */
export function ScrollDialogBody({
  submit,
  showsNotice = submit !== undefined,
  children,
}: ScrollDialogBodyProps): ReactNode {
  const notice = use(DialogNoticeContext)
  const isSlow = useHasWaited(submit?.isPending ?? false, SLOW_WRITE_MS)
  const errorRef = useRef<HTMLDivElement | null>(null)
  const failure = submit?.failure
  useEffect(() => {
    if (failure !== undefined) {
      errorRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [failure])
  // The outage notice says more, so it stands in for the hint.
  const slowWrite = isSlow && notice === undefined ? SLOW_WRITE : undefined
  return (
    <>
      <div data-slot="dialog-body" className="flex flex-col gap-5 overflow-y-auto p-4 empty:hidden">
        {children}
        {slowWrite === undefined ? undefined : <Muted>{slowWrite}</Muted>}
        {failure === undefined ? undefined : (
          <div ref={errorRef}>
            <NoticeAlert message={failure.message} action={remedyActions(failure)} />
          </div>
        )}
        {showsNotice ? notice : undefined}
      </div>
      {/*
       * A live region must be mounted before its text arrives, and one inside the body would keep
       * an empty body from collapsing. `sr-only` keeps it out of the dialog's grid rows.
       */}
      {submit === undefined ? undefined : (
        <p role="status" className="sr-only">
          {slowWrite}
        </p>
      )}
    </>
  )
}

type ScrollDialogProps = ScrollDialogContentProps & {
  isOpen: boolean
  onClose: () => void
  /**
   * Once the exit animation ends, so what the closing dialog still shows can be let go.
   */
  onClosed?: () => void
}

export function ScrollDialog({
  isOpen,
  onClose,
  onClosed,
  ...content
}: ScrollDialogProps): ReactNode {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isNowOpen) => {
        if (!isNowOpen) {
          onClose()
        }
      }}
      onOpenChangeComplete={(isNowOpen) => {
        if (!isNowOpen) {
          onClosed?.()
        }
      }}
    >
      {/* Its opener, work and reads are its own, not an enclosing dialog's. */}
      <DialogScopeContext value={undefined}>
        <DialogReadFailureContext value={undefined}>
          <ScrollDialogContent {...content} />
        </DialogReadFailureContext>
      </DialogScopeContext>
    </Dialog>
  )
}
