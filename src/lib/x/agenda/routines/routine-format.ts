import { formatDuration } from '@convex/shared/durations'
import { INTERVAL_UNITS, spanMs } from '@convex/shared/goalRules'
import type { IntervalKind } from '@convex/shared/goalRules'
import { MINUTE_MS } from '@convex/shared/limits'
import { toLocal } from '@convex/shared/localTime'

import { MONTHS } from '@/lib/months'

import type { RoutineLog } from '../doc-types'
import { formatLocalDateTime, formatLocalTime, WEEKDAYS } from '../time/dates'
import type { Goal, Reminder, RoutineStatus } from './schedule'

/**
 * `current` names the interval around now, `other` any other.
 */
type KindWords = { title: string; current: string; other: string }

export const KIND_WORDS: Record<IntervalKind, KindWords> = {
  daily: { title: 'Daily', current: 'today', other: 'that day' },
  weekly: { title: 'Weekly', current: 'this week', other: 'that week' },
  monthly: { title: 'Monthly', current: 'this month', other: 'that month' },
  yearly: { title: 'Yearly', current: 'this year', other: 'that year' },
}

export function intervalWords(kind: IntervalKind, isCurrent: boolean): string {
  return KIND_WORDS[kind][isCurrent ? 'current' : 'other']
}

export function wholeMinutes(log: RoutineLog): number {
  return Math.round(spanMs(log) / MINUTE_MS)
}

export function minutesLabel(log: RoutineLog): string {
  return formatDuration(wholeMinutes(log))
}

/**
 * In the log's recorded zone. A device whose tzdata lacks that zone counts on from the start
 * instead, which is off only across an offset change during the log.
 */
function endedLocal(log: Pick<RoutineLog, 'started' | 'ended' | 'timeZone'>): number {
  try {
    return toLocal(log.ended.at, log.timeZone)
  } catch {
    return log.started.atLocal + (log.ended.at - log.started.at)
  }
}

/**
 * The end is dated when it falls on another day than the start, as in "23:30–16 Sep, 00:30". A log
 * that ends in the minute it starts shows its start alone.
 */
export function spanLabel(log: Pick<RoutineLog, 'started' | 'ended' | 'timeZone'>): string {
  const start = formatLocalTime(log.started.atLocal)
  const end = formatLocalDateTime(endedLocal(log), log.started.atLocal)
  return end === start ? start : `${start}–${end}`
}

function times(count: number): string {
  return count === 1 ? 'Once' : count === 2 ? 'Twice' : `${count} times`
}

export function goalSummary(goal: Goal): string {
  const frequency = `${times(goal.count)} a ${INTERVAL_UNITS[goal.kind]}`
  return goal.minutesEach === undefined
    ? frequency
    : `${frequency}, ${formatDuration(goal.minutesEach)} each`
}

export function formatMinuteOfDay(minuteOfDay: number): string {
  return formatLocalTime(minuteOfDay * MINUTE_MS)
}

function ordinal(value: number): string {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][value % 10] ?? 'th')
  return `${value}${suffix}`
}

export function dayLabel(day: number): string {
  return day > 0 ? ordinal(day) : day === -1 ? 'last day' : `${ordinal(-day)} from last`
}

export function reminderLabel(reminder: Reminder): string {
  const time = formatMinuteOfDay(reminder.minuteOfDay)
  if ('month' in reminder) {
    return `${MONTHS[reminder.month - 1] ?? ''}, ${dayLabel(reminder.day)}, ${time}`
  }
  if ('day' in reminder) {
    return `${dayLabel(reminder.day)}, ${time}`
  }
  return 'weekday' in reminder ? `${WEEKDAYS[reminder.weekday - 1] ?? ''} ${time}` : time
}

/**
 * Uncapped, so time logged past the goal still shows. Time is rounded down, so a nearly done
 * occurrence never reads as done.
 */
export function progressLabel(
  goal: Goal,
  { completed, loggedMs }: RoutineStatus,
  { isCurrent }: { isCurrent: boolean },
): string {
  const words = intervalWords(goal.kind, isCurrent)
  return goal.minutesEach === undefined
    ? `${completed} of ${goal.count} ${words}`
    : `${formatDuration(loggedMs / MINUTE_MS)} of ${formatDuration(goal.count * goal.minutesEach)} ${words}`
}

export function owedLabel(
  goal: Goal,
  { owed }: RoutineStatus,
  { isCurrent }: { isCurrent: boolean },
): string {
  return `${owed} owed ${intervalWords(goal.kind, isCurrent)}`
}
