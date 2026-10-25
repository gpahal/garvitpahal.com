import { api } from '@convex/_generated/api'

import type { Task } from '@/lib/x/agenda/doc-types'
import { useManageDialogs } from '@/hooks/use-manage-dialogs'
import type { ManageDialogs } from '@/hooks/use-manage-dialogs'

import { useLiveDoc } from '../dialogs/use-live'
import { TaskActions } from './task-actions'
import { TaskForm } from './task-form'

type TaskDialogsOptions = {
  /**
   * A new task starts showing at this day's first instant in the form's zone; without it a new task
   * shows immediately.
   */
  defaultShowDay?: number
  onSaved?: (showAt: number) => void
}

export function useLiveTask(opened: Task): Task | null | undefined | Error {
  return useLiveDoc(api.tasks.get, opened)
}

export function useTaskDialogs({
  defaultShowDay,
  onSaved,
}: TaskDialogsOptions = {}): ManageDialogs<Task> {
  return useManageDialogs({
    useLive: useLiveTask,
    // Completed, here or in another tab: there is nothing left to do to it. The server still takes
    // an open edit's save.
    goneNotice: (live) =>
      live.done === undefined
        ? undefined
        : `"${live.name}" was marked done elsewhere. Saving still changes it`,
    newLabel: 'New task',
    renderActions: (task, on) => <TaskActions task={task} {...on} />,
    renderForm: (task, onClose) => (
      <TaskForm task={task} defaultShowDay={defaultShowDay} onSaved={onSaved} onClose={onClose} />
    ),
  })
}
