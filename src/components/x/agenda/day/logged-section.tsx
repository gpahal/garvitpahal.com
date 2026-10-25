import type { ReactNode } from 'react'

import type { Routine, RoutineLog, Task } from '@/lib/x/agenda/doc-types'
import { minutesLabel, spanLabel, wholeMinutes } from '@/lib/x/agenda/routines/routine-format'
import { formatLocalTime } from '@/lib/x/agenda/time/dates'
import { OpenRow, RowTime } from '@/components/shared/open-row'
import { RowSection } from '@/components/shared/row-section'

import { GrowMore } from '../lists/grow-more'
import type { Logged } from './use-logged'

type LoggedEntryRow = Logged['entries'][number]

type LoggedSectionProps = {
  logged: Logged
  onOpenLog: (log: RoutineLog, routine: Routine) => void
  onOpenTask: (task: Task) => void
}

/**
 * An empty day has no section, while a cut one with no row yet keeps its "Load more". The dialogs
 * belong to the screen, not to this section, which comes and goes as its day loads.
 */
export function LoggedSection({ logged, onOpenLog, onOpenTask }: LoggedSectionProps): ReactNode {
  return logged.isEmpty ? undefined : (
    <RowSection
      title="Logged"
      level="h3"
      after={
        <GrowMore
          growing={logged.growing}
          hasMore={logged.hasMore}
          isLoading={logged.isLoadingMore}
        />
      }
    >
      {logged.entries.map((entry) => (
        <li key={entry.kind === 'log' ? entry.log._id : entry.task._id}>
          <LoggedRow entry={entry} onOpenLog={onOpenLog} onOpenTask={onOpenTask} />
        </li>
      ))}
    </RowSection>
  )
}

type LoggedRowProps = { entry: LoggedEntryRow } & Omit<LoggedSectionProps, 'logged'>

/**
 * One row for both kinds, so a change cannot reach logs and miss tasks.
 */
function LoggedRow({ entry, onOpenLog, onOpenTask }: LoggedRowProps): ReactNode {
  const row =
    entry.kind === 'log'
      ? {
          title: entry.routine.name,
          description:
            wholeMinutes(entry.log) > 0 ? `Routine · ${minutesLabel(entry.log)}` : 'Routine',
          time: spanLabel(entry.log),
          onOpen: () => {
            onOpenLog(entry.log, entry.routine)
          },
        }
      : {
          title: entry.task.name,
          description: 'Task',
          time: `Done ${formatLocalTime(entry.atLocal)}`,
          onOpen: () => {
            onOpenTask(entry.task)
          },
        }
  return (
    <OpenRow
      title={row.title}
      description={row.description}
      aside={<RowTime>{row.time}</RowTime>}
      onOpen={row.onOpen}
    />
  )
}
