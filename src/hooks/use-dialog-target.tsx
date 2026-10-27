import {
  Fragment,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { ancestryOf, finalFocusOf } from '@/lib/final-focus'
import { DialogScopeContext } from '@/hooks/use-dialog-work'
import type { WorkState } from '@/hooks/use-dialog-work'
import { useDiscardConfirmation } from '@/hooks/use-discard-confirmation'
import type { Question } from '@/hooks/use-discard-confirmation'
import { useStandIn } from '@/hooks/use-stand-in'
import { Dialog } from '@/components/ui/dialog'

type DialogTarget<Target> = {
  target: Target | undefined
  show: (next: Target) => void
  /**
   * Closes only the opening this render showed, so a late save cannot close a newer one, even on
   * the same subject.
   */
  close: () => void
  /**
   * Closes without asking, for a subject that is gone while the content holds no work.
   */
  dismiss: () => void
  work: WorkState
  isOpen: boolean
  render: (content: ReactNode) => ReactNode
}

const NO_WORK: WorkState = { dirty: false, pending: false }

const DISCARD_CHANGES: Question = {
  title: 'Discard changes?',
  body: 'Your unsaved changes will be lost',
  confirm: 'Discard changes',
}

/**
 * One dialog a screen opens on a subject, such as a task. Closing asks first over unsaved changes,
 * and while a write is in flight the dialog stays open, against Escape and outside presses too, so
 * its failure shows in the form that made it.
 */
export function useDialogTarget<Target>(): DialogTarget<Target> {
  // `target` outlives `isOpen` so closing content stays mounted for its animation. `opening` keys the
  // content, so drafts never leak across subjects, and tells a late save which opening it belongs to.
  type DialogState = { target: Target | undefined; isOpen: boolean; opening: number }
  const [state, setState] = useState<DialogState>({
    target: undefined,
    isOpen: false,
    opening: 0,
  })
  const { target, isOpen, opening } = state
  const workRef = useRef<WorkState>(NO_WORK)
  const [work, setWork] = useState(NO_WORK)
  const isOpenRef = useRef(isOpen)
  useLayoutEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])
  // What opened the dialog, and around it what can stand in once its own action has removed it.
  const openerRef = useRef<Array<HTMLElement>>([])
  const finalFocus = useCallback(() => finalFocusOf(openerRef.current), [])
  const confirmation = useDiscardConfirmation()
  const { ask, clear } = confirmation
  const register = useCallback((next: WorkState) => {
    workRef.current = next
    setWork(next)
    return () => {
      workRef.current = NO_WORK
      setWork(NO_WORK)
    }
  }, [])
  // Closing content is still mounted, but its work was already saved or discarded.
  const leave = (then: () => void): void => {
    const current = isOpenRef.current ? workRef.current : NO_WORK
    if (!current.pending) {
      ask(current.dirty, DISCARD_CHANGES, then)
    }
  }
  const show = (next: Target): void => {
    leave(() => {
      // A switch while open keeps the first opener: the one it has now is inside the dialog.
      if (!isOpenRef.current) {
        const opener = document.activeElement
        openerRef.current = opener instanceof HTMLElement ? ancestryOf(opener) : []
      }
      clear()
      setState((current) => ({ target: next, isOpen: true, opening: current.opening + 1 }))
    })
  }
  const scope = useMemo(() => ({ finalFocus, register }), [finalFocus, register])
  return {
    target,
    show,
    work,
    isOpen,
    close: () => {
      setState((current) => (current.opening === opening ? { ...current, isOpen: false } : current))
    },
    dismiss: () => {
      if (!isOpen) {
        return
      }
      clear()
      setState((current) => ({ ...current, isOpen: false }))
    },
    render: (content) => (
      <>
        <Dialog
          open={isOpen}
          onOpenChange={(isNowOpen) => {
            if (!isNowOpen && isOpen) {
              leave(() => {
                setState((current) => ({ ...current, isOpen: false }))
              })
            }
          }}
          onOpenChangeComplete={(isNowOpen) => {
            if (!isNowOpen) {
              setState((current) =>
                current.isOpen
                  ? current
                  : { target: undefined, isOpen: false, opening: current.opening },
              )
            }
          }}
        >
          <DialogScopeContext value={scope}>
            <Fragment key={opening}>{content}</Fragment>
          </DialogScopeContext>
        </Dialog>
        {isOpen ? confirmation.dialog : undefined}
      </>
    ),
  }
}

export type LiveDialog = Pick<DialogTarget<unknown>, 'dismiss' | 'work' | 'isOpen'>

type LiveSubjectOptions<Subject> = {
  /**
   * Why a subject that still exists is no longer the dialog's, such as a task marked done
   * elsewhere, as a sentence for a form it leaves open.
   */
  goneNotice?: (live: Subject) => string | undefined
  name: string
  formFields?: (live: Subject) => unknown
}

type LiveSubject<Subject> = {
  /**
   * `undefined` while it loads. Once it is deleted or gone, or its read fails, the last one seen,
   * so the dialog never empties as it closes or shows the failure.
   */
  subject: Subject | undefined
  failure: Error | undefined
  notice: string | undefined
}

/**
 * The live document an open dialog's content reads: `undefined` while it loads and `null` once
 * deleted. A deleted or gone subject closes the dialog unless the content holds work: over unsaved
 * changes it stays open and says why, and over a write in flight it waits for it to settle.
 */
export function useLiveSubject<Subject>(
  { dismiss, work, isOpen }: LiveDialog,
  read: Subject | null | undefined | Error,
  { goneNotice = () => undefined, name, formFields = (live) => live }: LiveSubjectOptions<Subject>,
): LiveSubject<Subject> {
  const failure = read instanceof Error ? read : undefined
  const live = read instanceof Error ? undefined : read
  const isDeleted = live === null
  const gone = live === null || live === undefined ? undefined : goneNotice(live)
  const isOver = isDeleted || gone !== undefined
  const shouldDismiss = isOver && !work.dirty && !work.pending
  // After the commit: the screen's state cannot update while the content renders.
  const onDismiss = useEffectEvent(dismiss)
  useEffect(() => {
    if (shouldDismiss) {
      onDismiss()
    }
  }, [shouldDismiss])
  const subject = useStandIn(isOver ? undefined : (live ?? undefined), undefined)
  const fields = subject === undefined ? undefined : JSON.stringify(formFields(subject))
  const [openedFields, setOpenedFields] = useState(fields)
  if (openedFields === undefined && fields !== undefined) {
    setOpenedFields(fields)
  }
  // Not while a write is in flight: the dialog's own save or delete changes the subject before it
  // closes.
  const notice =
    !isOpen || work.pending
      ? undefined
      : isOver
        ? work.dirty
          ? (gone ?? `${name} was deleted elsewhere, so your changes cannot be saved`)
          : undefined
        : fields === openedFields
          ? undefined
          : `${name} was changed elsewhere after this form opened. It still shows what it opened with, and saving changes only the fields you edited`
  return { subject, failure, notice }
}
