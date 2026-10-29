import type { Goal } from '../schema'
import { formatDuration } from './durations'
import { DAY_MINUTES, isWholeWithin, MAX_GOAL_COUNT, MAX_REMINDERS, MINUTE_MS } from './limits'

/**
 * What a validator cannot say about a goal, its reminders and its logs.
 */

export const INTERVAL_KINDS = ['daily', 'weekly', 'monthly', 'yearly'] as const

export type IntervalKind = (typeof INTERVAL_KINDS)[number]

export const LAST_MINUTE_OF_DAY = 1439

export function isGoalCount(count: number): boolean {
  return isWholeWithin(count, 1, MAX_GOAL_COUNT)
}

/**
 * No maximum of its own: `goalFitIssue` holds it to its interval's length.
 */
export function minutesEachIssue(minutes: number): string | undefined {
  return Number.isSafeInteger(minutes) && minutes >= 1
    ? undefined
    : `Enter at least ${formatDuration(1)}, or leave the duration blank`
}

/**
 * Each interval at its shortest, so a goal that fits one fits every one. A day is 24 hours, though
 * a clock change makes one 23.
 */
export const INTERVAL_MINUTES: Record<IntervalKind, number> = {
  daily: DAY_MINUTES,
  weekly: 7 * DAY_MINUTES,
  monthly: 28 * DAY_MINUTES,
  yearly: 365 * DAY_MINUTES,
}

export const INTERVAL_UNITS: Record<IntervalKind, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
}

/**
 * Asked only of a count and a duration that are each in range.
 */
export function goalFitIssue(
  kind: IntervalKind,
  count: number,
  minutesEach: number | undefined,
): string | undefined {
  if (minutesEach === undefined || count * minutesEach <= INTERVAL_MINUTES[kind]) {
    return undefined
  }
  const holds = `is more than a ${INTERVAL_UNITS[kind]} holds`
  return count === 1
    ? `${formatDuration(minutesEach)} ${holds}. Lower the duration each`
    : `${count} × ${formatDuration(minutesEach)} ${holds}. Lower the times or the duration each`
}

/**
 * Asked only of a length a save sets, so a stored log survives a goal change.
 */
export function logLengthIssue(kind: IntervalKind, lengthMs: number): string | undefined {
  const most = INTERVAL_MINUTES[kind]
  return lengthMs > most * MINUTE_MS
    ? `A log can be at most ${formatDuration(most)} long`
    : undefined
}

/**
 * Only a count goal's logs may have no length. Asked only of a length a save sets, so a stored log
 * keeps whatever it has.
 */
export function logDurationIssue(hasDuration: boolean, lengthMs: number): string | undefined {
  return hasDuration && lengthMs < MINUTE_MS ? 'Enter a duration' : undefined
}

/**
 * A goal with no reminders is impossible on purpose.
 */
export function reminderCountIssue(goalCount: number, reminderCount: number): string | undefined {
  if (reminderCount < goalCount) {
    return 'Add at least one reminder for each time'
  }
  return reminderCount > MAX_REMINDERS
    ? `A routine can have at most ${MAX_REMINDERS} reminders`
    : undefined
}

type LogSpan = { started: { at: number }; ended: { at: number } }

/**
 * Real elapsed time, whatever the wall clock did meanwhile.
 */
export function spanMs({ started, ended }: LogSpan): number {
  return ended.at - started.at
}

export type LogTotals = { count: number; loggedMs: number }

/**
 * An archived routine takes no new logs and is owed nothing, but keeps the logs it has.
 */
export function isActive(routine: { archivedAt?: number }): boolean {
  return routine.archivedAt === undefined
}

/**
 * The longest each month gets, so 29 February is a day and 30 February is not.
 */
const MONTH_LENGTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * A monthly reminder names no month, so it gets the longest.
 */
export function longestLength(month: number | undefined): number {
  return (month === undefined ? undefined : MONTH_LENGTHS[month - 1]) ?? 31
}

export function isSignedDay(day: number, length: number): boolean {
  return Number.isSafeInteger(day) && day !== 0 && Math.abs(day) <= length
}

/**
 * A day the period lacks is `undefined`, never the nearest one: the 31st must not fire on the 1st.
 */
export function resolveDay(day: number, length: number): number | undefined {
  const resolved = day < 0 ? length + day + 1 : day
  return resolved >= 1 && resolved <= length ? resolved : undefined
}

type ReminderSlot = { minuteOfDay: number; weekday?: number; day?: number; month?: number }

/**
 * Equal for the same nudge, on only the fields the kind uses. 1 January and -31 January share a
 * key, but February and monthly reminders have no fixed length, so their two spellings stay two
 * reminders.
 */
export function reminderSlotKey(
  kind: IntervalKind,
  { minuteOfDay, weekday, day, month }: ReminderSlot,
): string {
  switch (kind) {
    case 'daily': {
      return String(minuteOfDay)
    }
    case 'weekly': {
      return `${String(weekday)}/${String(minuteOfDay)}`
    }
    case 'monthly': {
      return `${String(day)}/${String(minuteOfDay)}`
    }
    case 'yearly': {
      const isFixedLength = month !== undefined && month !== 2
      // A day the month lacks is refused elsewhere, so it only has to key as itself.
      const fromStart =
        isFixedLength && day !== undefined ? (resolveDay(day, longestLength(month)) ?? day) : day
      return `${String(month)}/${String(fromStart)}/${String(minuteOfDay)}`
    }
  }
}

function dayIssue(day: number, length: number): string | undefined {
  return isSignedDay(day, length)
    ? undefined
    : `Day must be from 1 to ${String(length)}, or -1 to -${String(length)}`
}

export function goalIssue(goal: Goal): string | undefined {
  const { kind, count, minutesEach, reminders } = goal
  return (
    (isGoalCount(count)
      ? undefined
      : `Goal count must be a whole number from 1 to ${String(MAX_GOAL_COUNT)}`) ??
    (minutesEach === undefined ? undefined : minutesEachIssue(minutesEach)) ??
    goalFitIssue(kind, count, minutesEach) ??
    reminderCountIssue(count, reminders.length) ??
    reminderRangeIssue(goal) ??
    // Last, so two identical reminders out of range hear about the range, which is what to fix.
    (new Set(reminders.map((reminder) => reminderSlotKey(kind, reminder))).size === reminders.length
      ? undefined
      : 'Two reminders are the same. Change or remove one of them')
  )
}

/**
 * Time of day first.
 */
function reminderRangeIssue(goal: Goal): string | undefined {
  const timeIssue = firstIssue(goal.reminders, ({ minuteOfDay }) =>
    isWholeWithin(minuteOfDay, 0, LAST_MINUTE_OF_DAY)
      ? undefined
      : 'Reminder time is not a time of day',
  )
  if (timeIssue !== undefined) {
    return timeIssue
  }
  // A `switch` rather than a table, as the narrowing makes each kind's fields present without a cast.
  switch (goal.kind) {
    case 'daily': {
      return undefined
    }
    case 'weekly': {
      return firstIssue(goal.reminders, ({ weekday }) =>
        isWholeWithin(weekday, 1, 7) ? undefined : 'Weekday must be from 1 (Monday) to 7 (Sunday)',
      )
    }
    case 'monthly': {
      return firstIssue(goal.reminders, ({ day }) => dayIssue(day, longestLength(undefined)))
    }
    case 'yearly': {
      return firstIssue(goal.reminders, ({ month, day }) =>
        isWholeWithin(month, 1, 12)
          ? dayIssue(day, longestLength(month))
          : 'Month must be from 1 to 12',
      )
    }
  }
}

function firstIssue<T>(
  items: Iterable<T>,
  issue: (item: T) => string | undefined,
): string | undefined {
  for (const item of items) {
    const found = issue(item)
    if (found !== undefined) {
      return found
    }
  }
  return undefined
}
