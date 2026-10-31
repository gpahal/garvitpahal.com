import type { Doc } from '../_generated/dataModel'
import { INTERVAL_UNITS } from '../shared/goalRules'
import type { IntervalKind } from '../shared/goalRules'
import type { Notification } from './ntfy'

/**
 * Keeps a message under ntfy's 4,096 bytes, past which it arrives as an attachment.
 */
const DESCRIPTION_SHOWN = 500
const SUMMARY_NAMES = 8
const SUMMARY_NAME_SHOWN = 60

/**
 * ntfy's 'low' priority, which arrives without a sound.
 */
const QUIET = 2

function shortened(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text
}

function currentInterval(kind: IntervalKind): string {
  return kind === 'daily' ? 'today' : `this ${INTERVAL_UNITS[kind]}`
}

function counted(count: number, noun: string, hasMore = false): string {
  return `${String(count)}${hasMore ? '+' : ''} ${noun}${count === 1 && !hasMore ? '' : 's'}`
}

export function taskDueNotification(task: Pick<Doc<'tasks'>, '_id' | 'name' | 'description'>) {
  return {
    sequenceId: `task-${task._id}`,
    title: task.name,
    message:
      task.description === undefined ? 'Due now' : shortened(task.description, DESCRIPTION_SHOWN),
  } satisfies Notification
}

export function routineReminderNotification(
  routine: Pick<Doc<'routines'>, '_id' | 'name' | 'goal'>,
  owed: number,
) {
  const { kind, count } = routine.goal
  const when = currentInterval(kind)
  return {
    sequenceId: `routine-${routine._id}`,
    title: routine.name,
    message:
      count === 1
        ? `Not done yet ${when}`
        : `${String(owed)} of ${String(count)} still to do ${when}`,
  } satisfies Notification
}

function namesLine(label: string, names: Array<string>, hasMore: boolean): string {
  const shown = names.slice(0, SUMMARY_NAMES).map((name) => shortened(name, SUMMARY_NAME_SHOWN))
  const rest = names.length - shown.length
  const more = hasMore || rest > 0 ? ` and ${hasMore ? 'more' : `${String(rest)} more`}` : ''
  return `${label}: ${shown.join(', ')}${more}`
}

/**
 * `tasks` are those shown by the end of the day, overdue ones included, and `hasMoreTasks` says the
 * read was cut.
 */
export function morningSummaryNotification({
  tasks,
  hasMoreTasks,
  routines,
}: {
  tasks: Array<string>
  hasMoreTasks: boolean
  routines: Array<string>
}) {
  if (tasks.length === 0 && routines.length === 0) {
    return {
      sequenceId: 'summary',
      title: 'Nothing due today',
      message: 'No tasks or routines are due today',
      priority: QUIET,
    } satisfies Notification
  }
  const parts = [
    tasks.length > 0 ? counted(tasks.length, 'task', hasMoreTasks) : undefined,
    routines.length > 0 ? counted(routines.length, 'routine') : undefined,
  ].filter((part) => part !== undefined)
  const lines = [
    tasks.length > 0 ? namesLine('Tasks', tasks, hasMoreTasks) : undefined,
    routines.length > 0 ? namesLine('Routines', routines, false) : undefined,
  ].filter((line) => line !== undefined)
  return {
    sequenceId: 'summary',
    title: `${parts.join(' and ')} today`,
    message: lines.join('\n'),
  } satisfies Notification
}
