import type { Goal } from '../schema'
import { resolveDay } from './goalRules'
import type { LogTotals } from './goalRules'
import { daysInMonth, intervalOfDay } from './intervals'
import type { TimeRange } from './intervals'
import { DAY_MS, MINUTE_MS } from './limits'
import { dayOfInstant, fromLocal } from './localTime'

export type { Goal } from '../schema'

/**
 * Reminders are nudges, not slots: a log is never matched to an occurrence, it counts towards the
 * interval it was recorded in.
 */

export type Reminder = Goal['reminders'][number]

export type ScheduledRoutine = { _creationTime: number; archivedAt?: number; goal: Goal }

export type RoutineStatus = {
  /**
   * A range of local instants.
   */
  interval: TimeRange
  /**
   * The log count, uncapped, or for a goal with a duration the logged time in occurrences,
   * fractional and capped at the goal's count.
   */
  completed: number
  loggedMs: number
  owed: number
}

function dayOffset(reminder: Reminder, interval: TimeRange): number | undefined {
  const year = new Date(interval.start).getUTCFullYear()
  if ('month' in reminder) {
    const day = resolveDay(reminder.day, daysInMonth(year, reminder.month))
    return day === undefined
      ? undefined
      : (Date.UTC(year, reminder.month - 1, day) - interval.start) / DAY_MS
  }
  if ('day' in reminder) {
    const day = resolveDay(reminder.day, (interval.end - interval.start) / DAY_MS)
    return day === undefined ? undefined : day - 1
  }
  return 'weekday' in reminder ? reminder.weekday - 1 : 0
}

/**
 * Reminders that meet in one interval count twice (`reminderSlotKey` says why). Only reminders
 * between the routine's creation and its archive count, so none is back-filled.
 */
export function remindersElapsed(
  routine: ScheduledRoutine,
  interval: TimeRange,
  now: number,
  timeZone: string,
): number {
  const { archivedAt = Infinity } = routine
  return routine.goal.reminders.filter((reminder) => {
    const offset = dayOffset(reminder, interval)
    if (offset === undefined) {
      return false
    }
    const atLocal = interval.start + offset * DAY_MS + reminder.minuteOfDay * MINUTE_MS
    const at = fromLocal(atLocal, timeZone)
    return at <= now && at >= routine._creationTime && at < archivedAt
  }).length
}

export function completedOf(goal: Goal, { count, loggedMs }: LogTotals): number {
  return goal.minutesEach === undefined
    ? count
    : Math.min(goal.count, loggedMs / (goal.minutesEach * MINUTE_MS))
}

/**
 * For a day still ahead, pass its end as `now` to ask what will be owed then. `owed` counts only
 * elapsed reminders, so Monday morning is not a wall of the week's goals, and a half-finished
 * occurrence stays owed.
 */
export function routineStatusOf(
  routine: ScheduledRoutine,
  totals: LogTotals,
  interval: TimeRange,
  now: number,
  timeZone: string,
): RoutineStatus {
  const { goal } = routine
  const elapsed = remindersElapsed(routine, interval, now, timeZone)
  const completed = completedOf(goal, totals)
  const owed = Math.max(0, Math.min(goal.count, elapsed) - Math.floor(completed))
  return { interval, completed, loggedMs: totals.loggedMs, owed }
}

/**
 * Long enough for a 29 February reminder, which can be four years off.
 */
const DAYS_SEARCHED = 4 * 366 + 1

/**
 * The first reminder instant after `after`, or `undefined` if none comes within `DAYS_SEARCHED`
 * days. The reminder is on the first day with one ahead, since a later local reading never resolves
 * to an earlier instant.
 */
export function nextReminderAt(goal: Goal, after: number, timeZone: string): number | undefined {
  const firstDay = dayOfInstant(after, timeZone)
  for (let day = firstDay; day < firstDay + DAYS_SEARCHED; day += 1) {
    const interval = intervalOfDay(goal.kind, day)
    const offset = day - interval.start / DAY_MS
    const ahead = goal.reminders
      .filter((reminder) => dayOffset(reminder, interval) === offset)
      .map((reminder) => fromLocal(day * DAY_MS + reminder.minuteOfDay * MINUTE_MS, timeZone))
      .filter((at) => at > after)
    if (ahead.length > 0) {
      return Math.min(...ahead)
    }
  }
  return undefined
}
