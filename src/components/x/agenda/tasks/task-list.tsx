import type { ReactNode } from 'react'

import type { Task } from '@/lib/x/agenda/doc-types'
import { formatDateTime } from '@/lib/x/agenda/time/dates'
import { useDeviceTimeZone } from '@/hooks/use-device-time-zone'
import { OpenRow, RowTime } from '@/components/shared/open-row'
import { RowSection } from '@/components/shared/row-section'

type TaskListProps = {
  title: string
  level?: 'h2' | 'h3'
  tasks: Array<Task>
  /**
   * The tasks are showing, so each row's time is when it started to ("Since"). Otherwise it is when
   * a scheduled task will ("From").
   */
  isShowing: boolean
  now: number
  onOpen: (task: Task) => void
  after?: ReactNode
}

export function TaskList({
  title,
  level,
  tasks,
  isShowing,
  now,
  onOpen,
  after,
}: TaskListProps): ReactNode {
  const timeZone = useDeviceTimeZone()
  return tasks.length === 0 ? undefined : (
    <RowSection title={title} level={level} after={after}>
      {tasks.map((task) => (
        <li key={task._id}>
          <OpenRow
            title={task.name}
            description={task.description}
            aside={
              <RowTime>{`${isShowing ? 'Since' : 'From'} ${formatDateTime(task.showAt, timeZone, now)}`}</RowTime>
            }
            onOpen={() => {
              onOpen(task)
            }}
          />
        </li>
      ))}
    </RowSection>
  )
}
