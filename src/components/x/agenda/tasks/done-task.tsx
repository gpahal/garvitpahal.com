import { useRef } from 'react'
import type { ReactNode } from 'react'

import { useMutation } from 'convex/react'

import { api } from '@convex/_generated/api'
import { toLocal } from '@convex/shared/localTime'

import type { Task } from '@/lib/x/agenda/doc-types'
import { formatLocalDateTime } from '@/lib/x/agenda/time/dates'
import { useDeviceTimeZone } from '@/hooks/use-device-time-zone'
import type { LiveDialog } from '@/hooks/use-dialog-target'
import { useNow } from '@/hooks/use-now'
import { useSubmit } from '@/hooks/use-submit'
import { DetailDialogContent } from '@/components/shared/detail-dialog-content'
import { LiveSubjectContent } from '@/components/shared/live-subject-content'
import { SubmitButton } from '@/components/shared/pending-button'

import { useLiveTask } from './task-dialogs'
import { useConfirmDeleteTask } from './use-confirm-delete-task'

type LiveDoneTaskProps = {
  dialog: LiveDialog
  opened: Task
  onUndone: ((showAt: number) => void) | undefined
  onClose: () => void
}

export function LiveDoneTask({ dialog, opened, onUndone, onClose }: LiveDoneTaskProps): ReactNode {
  const now = useNow()
  const timeZone = useDeviceTimeZone()
  return (
    <LiveSubjectContent
      dialog={dialog}
      opened={opened}
      useLive={useLiveTask}
      // Un-completed, here or in another tab: there is nothing left to undo. With no form to stay
      // open for, the dialog closes.
      goneNotice={(live) =>
        live.done ? undefined : `"${live.name}" was marked not done elsewhere`
      }
      name={opened.name}
    >
      {(task) =>
        task.done ? (
          <DoneTask
            task={task}
            doneLabel={formatLocalDateTime(task.done.atLocal, toLocal(now, timeZone))}
            onUndone={onUndone}
            onClose={onClose}
          />
        ) : undefined
      }
    </LiveSubjectContent>
  )
}

type DoneTaskProps = {
  task: Task
  doneLabel: string
  onUndone: ((showAt: number) => void) | undefined
  onClose: () => void
}

function DoneTask({ task, doneLabel, onUndone, onClose }: DoneTaskProps): ReactNode {
  const uncomplete = useMutation(api.tasks.uncomplete)
  const submit = useSubmit()
  const markNotDoneRef = useRef<HTMLButtonElement | null>(null)
  const confirmDelete = useConfirmDeleteTask(task, submit, onClose)
  return (
    <DetailDialogContent
      title={task.name}
      summary={`Done ${doneLabel}`}
      description={task.description}
      submit={submit}
      initialFocus={markNotDoneRef}
      confirmDelete={confirmDelete}
      actions={
        <SubmitButton
          ref={markNotDoneRef}
          submit={submit}
          doing="marking not done"
          action={async () => uncomplete({ id: task._id })}
          onSuccess={() => {
            onUndone?.(task.showAt)
            onClose()
          }}
        >
          Mark not done
        </SubmitButton>
      }
    />
  )
}
