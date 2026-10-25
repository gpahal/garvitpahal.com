import { dayOfLocal, daysInMonth } from './intervals'
import { DAY_MS } from './limits'

/**
 * A task shows from `EARLIEST_LOCAL` to the same date next year, so a mistyped year is caught. The
 * form checks exact dates; the server has no zone for a task and keeps only backstops.
 */
export const SHOW_AT_TOO_LATE_ISSUE = 'Choose a date within a year from now'

/**
 * 28 February for 29 February.
 */
export function lastShowDay(today: number): number {
  const date = new Date(today * DAY_MS)
  const year = date.getUTCFullYear() + 1
  const month = date.getUTCMonth()
  const dateNextYear = Math.min(date.getUTCDate(), daysInMonth(year, month + 1))
  return dayOfLocal(Date.UTC(year, month, dateNextYear))
}

/**
 * Must never refuse what the form allows. A year and two days reaches the end of `lastShowDay` in
 * every zone with nothing to spare (Kiritimati, just after midnight on 1 March before a leap day). A
 * third day allows for a device clock ahead of the server's.
 */
export function latestShowAt(now: number): number {
  const date = new Date(now)
  date.setUTCFullYear(date.getUTCFullYear() + 1)
  return date.getTime() + 3 * DAY_MS
}
