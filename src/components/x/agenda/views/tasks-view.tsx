import type { ReactNode } from 'react'

import { api } from '@convex/_generated/api'
import { LIST_GROWTH } from '@convex/shared/limits'

import type { Task } from '@/lib/x/agenda/doc-types'
import { dueTasks, scheduledTasks } from '@/lib/x/agenda/due-tasks'
import { useGrowingLimit } from '@/hooks/use-growing-limit'
import { useNow } from '@/hooks/use-now'
import { EmptyState } from '@/components/shared/empty-state'
import { Loading } from '@/components/shared/loading'

import { GrowMore } from '../lists/grow-more'
import { useGrowingRead } from '../lists/use-growing-read'
import { useTaskDialogs } from '../tasks/task-dialogs'
import { TaskList } from '../tasks/task-list'
import { ManageView } from './manage-view'

export function TasksView(): ReactNode {
  const now = useNow()
  const { newButton: newTaskButton, open: openTask, dialogs } = useTaskDialogs()
  return (
    <>
      <ManageView newButton={newTaskButton} subject="your tasks">
        <TaskLists now={now} newButton={newTaskButton} onOpen={openTask} />
      </ManageView>
      {dialogs}
    </>
  )
}

type TaskListsProps = {
  now: number
  newButton: ReactNode
  onOpen: (task: Task) => void
}

function TaskLists({ now, newButton, onOpen }: TaskListsProps): ReactNode {
  const growing = useGrowingLimit(undefined, LIST_GROWTH)
  const { result, isLoading } = useGrowingRead(api.tasks.listOutstanding, { limit: growing.limit })
  return (
    <>
      {result?.rows.length === 0 ? (
        <EmptyState
          title="No tasks"
          description="Every outstanding task shows up here, including ones scheduled for later"
          action={newButton}
        />
      ) : undefined}
      {result === undefined ? (
        <Loading />
      ) : (
        <>
          <TaskList
            title="Due"
            tasks={dueTasks(result.rows, now)}
            isShowing
            now={now}
            onOpen={onOpen}
          />
          <TaskList
            title="Scheduled"
            tasks={scheduledTasks(result.rows, now)}
            isShowing={false}
            now={now}
            onOpen={onOpen}
          />
          <GrowMore growing={growing} hasMore={result.hasMore} isLoading={isLoading} />
        </>
      )}
    </>
  )
}
