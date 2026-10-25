import type { ReactNode } from 'react'

import type { Task } from '@/lib/x/agenda/doc-types'
import { useDialogTarget } from '@/hooks/use-dialog-target'

import { LiveDoneTask } from './done-task'

type DoneTaskDialog = {
  openTask: (task: Task) => void
  dialog: ReactNode
}

/**
 * A dialog like every other tap, since undoing a completion writes data too. `onUndone` hears the
 * show-at time of a task marked not done.
 */
export function useDoneTaskDialog(onUndone?: (showAt: number) => void): DoneTaskDialog {
  const dialog = useDialogTarget<Task>()
  const { target, show, close, render } = dialog
  return {
    openTask: show,
    dialog: render(
      target === undefined ? undefined : (
        <LiveDoneTask dialog={dialog} opened={target} onUndone={onUndone} onClose={close} />
      ),
    ),
  }
}
