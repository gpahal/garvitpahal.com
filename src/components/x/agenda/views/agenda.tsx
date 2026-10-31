import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from 'cn'
import { useQuery } from 'convex/react'

import { api } from '@convex/_generated/api'
import { isActive } from '@convex/shared/goalRules'
import { LIST_GROWTH } from '@convex/shared/limits'
import { dayOfInstant, instantRangeOfDay, toLocal } from '@convex/shared/localTime'

import { dayHref, dayOfParam, keptChoice } from '@/lib/x/agenda/day'
import type { Routine, RoutineLog, Task } from '@/lib/x/agenda/doc-types'
import { dueTasks } from '@/lib/x/agenda/due-tasks'
import { AGENDA_PATHS } from '@/lib/x/agenda/routes'
import { savedAway, savedAwayWords, taskDayOf } from '@/lib/x/agenda/saved-away'
import type { SavedAway } from '@/lib/x/agenda/saved-away'
import { isShowDayInReach } from '@/lib/x/agenda/task-show-at'
import { isoDateOfDay } from '@/lib/x/agenda/time/dates'
import { readDeviceTimeZone, useDeviceTimeZone } from '@/hooks/use-device-time-zone'
import { useGrowingLimit } from '@/hooks/use-growing-limit'
import { useNow } from '@/hooks/use-now'
import { AddButton } from '@/components/shared/add-button'
import { ButtonLink } from '@/components/shared/button-link'
import { EmptyState } from '@/components/shared/empty-state'
import { FOCUS_OUTLINE } from '@/components/shared/focus-outline'
import { Loading } from '@/components/shared/loading'
import { NoticeAlert } from '@/components/shared/notice-alert'

import { DayNavigation } from '../day/day-navigation'
import { LoggedSection } from '../day/logged-section'
import { replaceDayParam, useDayParam } from '../day/use-day-param'
import { useLaterToday } from '../day/use-later-today'
import { useLogged } from '../day/use-logged'
import { GrowMore } from '../lists/grow-more'
import { ListsBoundary } from '../lists/lists-boundary'
import { useGrowingRead } from '../lists/use-growing-read'
import { RoutineGroups } from '../routines/routine-list'
import { useRoutineLogDialog } from '../routines/routine-log-dialog'
import { RoutinePicker } from '../routines/routine-picker'
import { useRoutines, useTrackedRoutines } from '../routines/use-routines'
import { useDoneTaskDialog } from '../tasks/done-task-dialog'
import { useTaskDialogs } from '../tasks/task-dialogs'
import { TaskList } from '../tasks/task-list'

/**
 * The screen is a glance at the day, not the backlog: past this many, the rest are a tap away.
 */
const SHOWN_TASKS = 10

/**
 * Today is no choice rather than a date, so a view left on it follows the clock past midnight
 * (`keptChoice`).
 */
export function Agenda(): ReactNode {
  const now = useNow()
  const timeZone = useDeviceTimeZone()
  const inUrl = useDayParam()
  const today = dayOfInstant(now, timeZone)
  const chosen = keptChoice(dayOfParam(inUrl), today)
  const day = chosen ?? today

  useEffect(() => {
    // The raw value, since a value that names no date parses as no choice yet still has to go.
    if (inUrl !== (chosen === undefined ? null : isoDateOfDay(chosen))) {
      replaceDayParam(chosen)
    }
    // `inUrl` too: Back to an entry naming today leaves `chosen` unchanged but the URL untidy.
  }, [chosen, inUrl])

  const select = (selected: number): void => {
    replaceDayParam(keptChoice(selected, today))
  }
  const focusDayRef = useRef<number | undefined>(undefined)

  return (
    <Day
      day={day}
      today={today}
      now={now}
      navigation={
        <DayNavigation day={day} today={today} focusDayRef={focusDayRef} onSelect={select} />
      }
      onSelect={(selected) => {
        focusDayRef.current = selected
        select(selected)
      }}
    />
  )
}

/**
 * A past day shows only its record. Today shows tasks whose show-at time has passed, routines owing
 * now and the record so far; tasks for later today are only counted, with a link to the Tasks page.
 * A future day shows tasks set to show within it, so an overdue task stays on today, and routines
 * still owing at its end if nothing more is logged.
 */
type DayKind = 'past' | 'today' | 'future'

const EMPTY_STATES: Record<DayKind, { title: string; description: string }> = {
  past: {
    title: 'Nothing logged',
    description: 'Routine logs and completed tasks from this day would show up here',
  },
  today: {
    title: 'Nothing due now',
    description: 'Tasks and routines that are due will show up here',
  },
  future: {
    title: 'Nothing scheduled',
    description:
      'Tasks set to show on this day, and routines still owing by its end, will show up here',
  },
}

const OUT_OF_REACH_EMPTY_STATE = {
  title: EMPTY_STATES.future.title,
  description:
    'Routines still owing by the end of this day will show up here. Tasks can be set at most a year ahead',
}

type DayProps = {
  day: number
  today: number
  now: number
  navigation: ReactNode
  onSelect: (day: number) => void
}

/**
 * One component for every kind of day, so midnight never unmounts the dialogs and a draft survives
 * the date rolling over; for the same reason a dialog gets only its document (`use-live.ts`), never
 * a list. The lists sit under their own `ListsBoundary`, so a failed read replaces only them.
 */
function Day({ day, today, now, navigation, onSelect }: DayProps): ReactNode {
  const kind: DayKind = day < today ? 'past' : day > today ? 'future' : 'today'
  // A task or log saved from this day that went on another. Moving to another day, or a later save
  // landing on this one, forgets it, so it never outlives the screen or the save it was about.
  const [away, setAway] = useState<SavedAway>()
  if (away !== undefined && away.from !== day) {
    setAway(undefined)
  }
  const noteAway = (landedOn: number, saved: SavedAway['kind']): void => {
    setAway((previous) => savedAway(day, landedOn, saved, previous))
  }
  // The zone as of the save, as the lists read theirs.
  const taskDay = (showAt: number): number => taskDayOf(showAt, today, readDeviceTimeZone())
  const {
    newButton: newTaskButton,
    open: openTask,
    dialogs: taskDialogs,
  } = useTaskDialogs({
    // A task made from a day still ahead belongs on it, not on today, where "Immediately" puts it.
    defaultShowDay: kind === 'future' ? day : undefined,
    onSaved: (showAt) => {
      noteAway(taskDay(showAt), 'task')
    },
  })
  const { openTask: openDoneTask, dialog: doneTaskDialog } = useDoneTaskDialog((showAt) => {
    noteAway(taskDay(showAt), 'notDone')
  })
  const {
    logRoutine,
    openLog,
    dialog: routineDialog,
  } = useRoutineLogDialog((logged) => {
    noteAway(logged, 'log')
  })
  const [isPicking, setIsPicking] = useState(false)
  const pick = (): void => {
    setIsPicking(true)
  }
  const isInReach = isShowDayInReach(day, today)
  const primaryAction =
    kind === 'past' ? (
      <AddButton label="Log a routine" onClick={pick} />
    ) : isInReach ? (
      newTaskButton
    ) : undefined

  return (
    <div className="flex flex-col gap-8">
      {/* Above the rest, as the page's failure notices are. */}
      <SavedAwayStatus away={away} today={today} onSelect={onSelect} />
      <div className="flex items-center gap-2">
        <ButtonLink href={AGENDA_PATHS.tasks} variant="outline">
          Tasks
        </ButtonLink>
        <ButtonLink href={AGENDA_PATHS.routines} variant="outline">
          Routines
        </ButtonLink>
        {/* Always in the header, so it stays where it was found; the empty state repeats it. */}
        <div className="ml-auto">{primaryAction}</div>
      </div>
      {navigation}
      <ListsBoundary subject="this day" resetKey={day}>
        <DayLists
          kind={kind}
          day={day}
          today={today}
          now={now}
          isInReach={isInReach}
          primaryAction={primaryAction}
          onOpenTask={openTask}
          onOpenDoneTask={openDoneTask}
          onOpenLog={openLog}
          onLogRoutine={(routine) => {
            logRoutine(routine, day)
          }}
          onPick={pick}
        />
      </ListsBoundary>
      <RoutinePicker
        isOpen={isPicking}
        onPick={(routine) => {
          setIsPicking(false)
          logRoutine(routine, day)
        }}
        onClose={() => {
          setIsPicking(false)
        }}
      />
      {taskDialogs}
      {doneTaskDialog}
      {routineDialog}
    </div>
  )
}

/**
 * The live region stays mounted so a polite reader hears it fill, and is `sr-only` while empty so
 * it leaves no gap. Each save mounts a new node (`SavedAway.id`), so a repeat is announced again.
 */
function SavedAwayStatus({
  away,
  today,
  onSelect,
}: {
  away: SavedAway | undefined
  today: number
  onSelect: (day: number) => void
}): ReactNode {
  return (
    <div role="status" className={cn(away === undefined && 'sr-only')}>
      {away === undefined ? undefined : (
        <SavedAwayNotice key={away.id} away={away} today={today} onSelect={onSelect} />
      )}
    </div>
  )
}

function SavedAwayNotice({
  away,
  today,
  onSelect,
}: {
  away: SavedAway
  today: number
  onSelect: (day: number) => void
}): ReactNode {
  const { lead, dayLabel } = savedAwayWords(away, today)
  return (
    // The wrapper is the live region, so the alert is not announced itself.
    <NoticeAlert
      tone="success"
      announce="none"
      message={
        <>
          {lead}{' '}
          <a
            href={dayHref(keptChoice(away.day, today))}
            className={FOCUS_OUTLINE}
            onClick={(event) => {
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return
              }
              event.preventDefault()
              onSelect(away.day)
            }}
          >
            {dayLabel}
          </a>
        </>
      }
    />
  )
}

/**
 * `undefined` until the reads it waits on arrive. Today does not wait for its record, so the screen
 * does not blank at midnight while the new day's record, empty anyway, loads.
 */
function isDayEmpty(
  kind: DayKind,
  tasks: Array<unknown> | undefined,
  owing: Array<unknown> | undefined,
  logged: { isEmpty: boolean } | undefined,
): boolean | undefined {
  if (kind === 'past') {
    return logged?.isEmpty
  }
  if (tasks === undefined || owing === undefined) {
    return undefined
  }
  return tasks.length + owing.length === 0
}

type DayListsProps = {
  kind: DayKind
  day: number
  today: number
  now: number
  isInReach: boolean
  primaryAction: ReactNode
  onOpenTask: (task: Task) => void
  onOpenDoneTask: (task: Task) => void
  onOpenLog: (log: RoutineLog, routine: Routine) => void
  onLogRoutine: (routine: Routine) => void
  onPick: () => void
}

function DayLists({
  kind,
  day,
  today,
  now,
  isInReach,
  primaryAction,
  onOpenTask,
  onOpenDoneTask,
  onOpenLog,
  onLogRoutine,
  onPick,
}: DayListsProps): ReactNode {
  const timeZone = useDeviceTimeZone()
  const routines = useRoutines()

  // One more than is shown, which is what says there are more.
  const outstanding = useQuery(
    api.tasks.listOutstanding,
    kind === 'today' ? { limit: SHOWN_TASKS + 1 } : 'skip',
  )
  // Split against the clock here, not in the query (`tasks.listOutstanding` says why).
  const due = outstanding && dueTasks(outstanding.rows, now)

  const range = kind === 'future' ? instantRangeOfDay(day, timeZone) : undefined
  const laterLabel = useLaterToday(kind === 'today', today, now)
  const growing = useGrowingLimit(day, LIST_GROWTH)
  const { result: scheduled, isLoading: isLoadingScheduled } = useGrowingRead(
    api.tasks.listScheduled,
    range ? { ...range, limit: growing.limit } : 'skip',
  )

  // Today is measured as of now and a future day as of its last instant.
  const tracked = useTrackedRoutines(
    routines,
    kind === 'past' ? undefined : day,
    range ? range.end - 1 : now,
  )
  const owing = tracked?.filter(({ status }) => status.owed > 0)

  const logged = useLogged(day, routines, kind !== 'future')

  const tasks = kind === 'future' ? scheduled?.rows : due
  const hasActiveRoutines = routines?.some((routine) => isActive(routine)) ?? false

  // One placeholder until the first section this kind of day shows arrives, rather than one each.
  const sections = { past: [logged], today: [tasks, owing, logged], future: [tasks, owing] }
  const isLoading = sections[kind].every((section) => section === undefined)
  const isEmpty = isDayEmpty(kind, tasks, owing, logged)
  const emptyState = isInReach ? EMPTY_STATES[kind] : OUT_OF_REACH_EMPTY_STATE
  const nowLocal = toLocal(now, timeZone)

  return (
    <>
      {isEmpty ? (
        <EmptyState
          title={emptyState.title}
          description={emptyState.description}
          action={primaryAction}
        />
      ) : undefined}
      {isLoading ? <Loading /> : undefined}
      {tasks ? (
        <TaskList
          title="Tasks"
          level="h3"
          tasks={kind === 'today' ? tasks.slice(0, SHOWN_TASKS) : tasks}
          isShowing={kind === 'today'}
          now={now}
          onOpen={onOpenTask}
          after={
            <>
              {kind === 'today' && tasks.length > SHOWN_TASKS ? (
                <ButtonLink href={AGENDA_PATHS.tasks} variant="outline" className="self-start">
                  Show all due tasks
                </ButtonLink>
              ) : undefined}
              {kind === 'future' && scheduled ? (
                <GrowMore
                  growing={growing}
                  hasMore={scheduled.hasMore}
                  isLoading={isLoadingScheduled}
                />
              ) : undefined}
            </>
          }
        />
      ) : undefined}
      {laterLabel === undefined ? undefined : (
        <a
          href={AGENDA_PATHS.tasks}
          className={cn(
            FOCUS_OUTLINE,
            'self-start text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground',
          )}
        >
          {laterLabel}
        </a>
      )}
      {owing ? (
        <RoutineGroups tracked={owing} nowLocal={nowLocal} onOpen={onLogRoutine} />
      ) : undefined}
      {kind === 'today' && owing && hasActiveRoutines ? (
        <AddButton
          label="Log a routine"
          variant="outline"
          className="self-start"
          onClick={onPick}
        />
      ) : undefined}
      {logged ? (
        <LoggedSection logged={logged} onOpenLog={onOpenLog} onOpenTask={onOpenDoneTask} />
      ) : undefined}
    </>
  )
}
