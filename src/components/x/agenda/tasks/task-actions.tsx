import { useRef } from 'react'
import type { ReactNode } from 'react'

import { useMutation } from 'convex/react'

import { api } from '@convex/_generated/api'
import { toLocal } from '@convex/shared/localTime'

import type { Task } from '@/lib/x/agenda/doc-types'
import { isDue } from '@/lib/x/agenda/due-tasks'
import { formatDateTime } from '@/lib/x/agenda/time/dates'
import { readDeviceTimeZone, useDeviceTimeZone } from '@/hooks/use-device-time-zone'
import { useNow } from '@/hooks/use-now'
import { useSubmit } from '@/hooks/use-submit'
import { DetailDialogContent } from '@/components/shared/detail-dialog-content'
import { SubmitButton } from '@/components/shared/pending-button'
import { Button } from '@/components/ui/button'

import { useConfirmDeleteTask } from './use-confirm-delete-task'

type TaskActionsProps = {
  task: Task
  onEdit: () => void
  onClose: () => void
}

export function TaskActions({ task, onEdit, onClose }: TaskActionsProps): ReactNode {
  const now = useNow()
  const timeZone = useDeviceTimeZone()
  const complete = useMutation(api.tasks.complete)
  const submit = useSubmit()
  const markDoneRef = useRef<HTMLButtonElement | null>(null)
  const confirmDelete = useConfirmDeleteTask(task, submit, onClose)

  return (
    <DetailDialogContent
      title={task.name}
      summary={`${isDue(task, now) ? 'Showing since' : 'Shows from'} ${formatDateTime(task.showAt, timeZone, now)}`}
      description={task.description}
      submit={submit}
      initialFocus={markDoneRef}
      confirmDelete={confirmDelete}
      actions={
        <>
          <Button variant="outline" disabled={submit.isPending} onClick={onEdit}>
            Edit
          </Button>
          <SubmitButton
            ref={markDoneRef}
            submit={submit}
            doing="marking done"
            action={async () => {
              // The zone as of the click, like the instant: the reading files the task under that
              // day.
              const at = Date.now()
              const zone = readDeviceTimeZone()
              return complete({
                id: task._id,
                done: { at, atLocal: toLocal(at, zone), timeZone: zone },
              })
            }}
            onSuccess={onClose}
          >
            Mark done
          </SubmitButton>
        </>
      }
    />
  )
}
