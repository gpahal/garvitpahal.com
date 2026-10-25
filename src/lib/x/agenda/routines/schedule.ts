import type { Doc } from '@convex/_generated/dataModel'
import { isActive, resolveDay } from '@convex/shared/goalRules'
import type { LogTotals } from '@convex/shared/goalRules'
import { daysInMonth, intervalOfDay } from '@convex/shared/intervals'
import type { TimeRange } from '@convex/shared/intervals'
import { DAY_MS, MINUTE_MS } from '@convex/shared/limits'

import { fromLocal } from '../time/dates'

/**
 * Reminders are nudges, not slots: a log is never matched to an occurrence, it counts towards the
 * interval it was recorded in.
 */

export type Goal = Doc<'routines'>['goal']

export type Reminder = Goal['reminders'][number]

export type ScheduledRoutine = Pick<Doc<'routines'>, '_creationTime' | 'archivedAt' | 'goal'>

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

function completedOf(goal: Goal, { count, loggedMs }: LogTotals): number {
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

export type Tracked<TRoutine> = {
  routine: TRoutine
  status: RoutineStatus
}

type RoutineTotal = LogTotals & { routineId: string }

/**
 * Convex applies each write to every query in one transition, so after a goal edit the routines and
 * their totals change together. A missing total returns `undefined`, leaving the section loading
 * rather than counting a routine as having logged nothing.
 */
export function trackRoutines<TRoutine extends ScheduledRoutine & { _id: string }>(
  routines: Array<TRoutine>,
  read: Array<RoutineTotal>,
  day: number,
  now: number,
  timeZone: string,
): Array<Tracked<TRoutine>> | undefined {
  const totalsById = new Map(read.map((entry) => [entry.routineId, entry]))
  const tracked: Array<Tracked<TRoutine>> = []
  for (const routine of routines) {
    if (!isActive(routine)) {
      continue
    }
    const total = totalsById.get(routine._id)
    if (!total) {
      return undefined
    }
    const interval = intervalOfDay(routine.goal.kind, day)
    tracked.push({ routine, status: routineStatusOf(routine, total, interval, now, timeZone) })
  }
  return tracked
}
