import { useRef } from 'react'
import type { ReactNode } from 'react'

import { useMutation } from 'convex/react'

import { api } from '@convex/_generated/api'
import { isActive, reminderSlotKey } from '@convex/shared/goalRules'

import type { Routine } from '@/lib/x/agenda/doc-types'
import { goalSummary, reminderLabel } from '@/lib/x/agenda/routines/routine-format'
import { useConfirmDelete } from '@/hooks/use-confirm-delete'
import { useSubmit } from '@/hooks/use-submit'
import { DetailDialogContent } from '@/components/shared/detail-dialog-content'
import { SubmitButton } from '@/components/shared/pending-button'
import { SectionHeading } from '@/components/shared/row-section'
import { Button } from '@/components/ui/button'

type RoutineActionsProps = {
  routine: Routine
  onEdit: () => void
  onLog: () => void
  onClose: () => void
}

export function RoutineActions({
  routine,
  onEdit,
  onLog,
  onClose,
}: RoutineActionsProps): ReactNode {
  const archive = useMutation(api.routines.archive)
  const restore = useMutation(api.routines.restore)
  const remove = useMutation(api.routines.remove)
  // Archive and restore are told apart by what they do: the live routine can flip between the two
  // while one is in flight, and only the button that started it may say so.
  const submit = useSubmit()
  const primaryRef = useRef<HTMLButtonElement | null>(null)
  const confirmDelete = useConfirmDelete({
    question: 'Delete this routine and every log of it for good?',
    submit,
    remove: async () => remove({ id: routine._id }),
    onDeleted: onClose,
  })
  const isArchived = !isActive(routine)

  return (
    <DetailDialogContent
      title={routine.name}
      summary={`${goalSummary(routine.goal)}${isArchived ? ' · Archived' : ''}`}
      description={routine.description}
      submit={submit}
      initialFocus={primaryRef}
      confirmDelete={confirmDelete}
      // Delete only once archived: stopping a routine never costs its history.
      leading={
        isArchived ? (
          confirmDelete.button
        ) : (
          <SubmitButton
            variant="outline"
            className="sm:mr-auto"
            submit={submit}
            doing="archiving"
            action={async () => archive({ id: routine._id })}
            onSuccess={onClose}
          >
            Archive
          </SubmitButton>
        )
      }
      actions={
        <>
          <Button variant="outline" disabled={submit.isPending} onClick={onEdit}>
            Edit
          </Button>
          {isArchived ? (
            <SubmitButton
              ref={primaryRef}
              submit={submit}
              doing="restoring"
              action={async () => restore({ id: routine._id })}
              onSuccess={onClose}
            >
              Restore
            </SubmitButton>
          ) : (
            <Button ref={primaryRef} disabled={submit.isPending} onClick={onLog}>
              Log
            </Button>
          )}
        </>
      }
    >
      <section className="flex flex-col gap-1">
        <SectionHeading as="h3">Reminders</SectionHeading>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
          {routine.goal.reminders.map((reminder) => (
            // Unique within a goal: the server refuses a second reminder in one slot.
            <li key={reminderSlotKey(routine.goal.kind, reminder)}>{reminderLabel(reminder)}</li>
          ))}
        </ul>
      </section>
    </DetailDialogContent>
  )
}
