import { dayOfLocal, isoWeekdayOfDay, localRangeOfDay } from '@convex/shared/intervals'
import type { TimeRange } from '@convex/shared/intervals'
import { DAY_MS } from '@convex/shared/limits'
import { offsetAt, toLocal } from '@convex/shared/localTime'

import { MONTHS } from '@/lib/months'

/**
 * Two kinds of number, never mixed: an instant (`*At`) is UTC milliseconds, and a local instant
 * (`atLocal`) is a wall-clock reading encoded as if it were UTC, read through a `Date`'s UTC getters.
 * Local day D is `[D * DAY_MS, (D + 1) * DAY_MS)` of local instants, so no local date is stored.
 */

/**
 * A reading in a clocks-forward gap resolves to the change itself; one in a clocks-back repeat
 * resolves to the first.
 */
export function fromLocal(atLocal: number, timeZone: string): number {
  // A day either side lands on both sides of any clock change near the reading.
  const offsets = [
    ...new Set([atLocal - DAY_MS, atLocal + DAY_MS].map((at) => offsetAt(at, timeZone))),
  ]
  const candidates = offsets.map((offset) => atLocal - offset)
  const matches = candidates.filter((candidate) => toLocal(candidate, timeZone) === atLocal)
  if (matches.length > 0) {
    return Math.min(...matches)
  }
  // In a gap the clock reads below `atLocal` right up to the change and above it from then on.
  let before = Math.min(...candidates)
  let after = Math.max(...candidates)
  while (after - before > 1) {
    const middle = before + Math.floor((after - before) / 2)
    if (toLocal(middle, timeZone) > atLocal) {
      after = middle
    } else {
      before = middle
    }
  }
  return after
}

export function dayOfInstant(at: number, timeZone: string): number {
  return dayOfLocal(toLocal(at, timeZone))
}

/**
 * 23 or 25 hours long across a clock change.
 */
export function instantRangeOfDay(day: number, timeZone: string): TimeRange {
  const { start, end } = localRangeOfDay(day)
  return { start: fromLocal(start, timeZone), end: fromLocal(end, timeZone) }
}

export function localToDateTimeInput(atLocal: number): string {
  return new Date(atLocal).toISOString().slice(0, 16)
}

export function toDateTimeInput(at: number, timeZone: string): string {
  return localToDateTimeInput(toLocal(at, timeZone))
}

export function fromDateTimeInput(value: string, timeZone: string): number | undefined {
  const atLocal = localOfDateTimeInput(value)
  return atLocal === undefined ? undefined : fromLocal(atLocal, timeZone)
}

/**
 * A browser may add seconds to a `time` or `datetime-local` value, which no time here has.
 */
export function toMinuteInput(value: string): string {
  return value.replace(/(\d{2}:\d{2}):\d{2}(?:\.\d+)?$/, '$1')
}

function localOfDateTimeInput(value: string): number | undefined {
  const minute = toMinuteInput(value)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(minute)) {
    return undefined
  }
  const atLocal = Date.parse(`${minute}:00Z`)
  // `Date.parse` reads 30 February as 2 March, so a value counts only if it writes back as itself.
  return Number.isNaN(atLocal) || localToDateTimeInput(atLocal) !== minute ? undefined : atLocal
}

export function isoDateOfDay(day: number): string {
  return localToDateTimeInput(day * DAY_MS).slice(0, 10)
}

export function dayOfMonth(day: number): number {
  return new Date(day * DAY_MS).getUTCDate()
}

/**
 * `YYYY-MM-DD` and nothing more; `undefined` for anything else, a date the month lacks included.
 */
export function dayOfIsoDate(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined
  }
  const atLocal = localOfDateTimeInput(`${value}T00:00`)
  return atLocal === undefined ? undefined : dayOfLocal(atLocal)
}

/**
 * From Monday, as ISO weekdays count.
 */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Assembled by hand: `Date`'s formatting reads the device's zone, which this reading need not be in.
 */
function formatLocalDate(atLocal: number, nowLocal: number): string {
  const reading = new Date(atLocal)
  const date = `${reading.getUTCDate()} ${MONTHS[reading.getUTCMonth()] ?? ''}`
  return reading.getUTCFullYear() === new Date(nowLocal).getUTCFullYear()
    ? date
    : `${date} ${reading.getUTCFullYear()}`
}

export function formatDay(day: number, today: number): string {
  const weekday = WEEKDAYS[isoWeekdayOfDay(day) - 1] ?? ''
  return `${weekday} ${formatLocalDate(day * DAY_MS, today * DAY_MS)}`
}

export function formatLocalTime(atLocal: number): string {
  return new Date(atLocal).toISOString().slice(11, 16)
}

/**
 * Drops the date on the current day and the year within the current year. Needs no zone, so a
 * reading from a zone this device does not know still formats.
 */
export function formatLocalDateTime(atLocal: number, nowLocal: number): string {
  const time = formatLocalTime(atLocal)
  return dayOfLocal(atLocal) === dayOfLocal(nowLocal)
    ? time
    : `${formatLocalDate(atLocal, nowLocal)}, ${time}`
}

export function formatDateTime(at: number, timeZone: string, now: number): string {
  return formatLocalDateTime(toLocal(at, timeZone), toLocal(now, timeZone))
}

const STRIP_DAYS = 7

/**
 * A strip that already shows `day` stays put, so the tapped day does not jump from under the
 * pointer; otherwise it recentres on `day`, keeping days either side in view.
 */
export function stripStart(current: number | undefined, day: number): number {
  return current !== undefined && day >= current && day < current + STRIP_DAYS
    ? current
    : day - Math.floor(STRIP_DAYS / 2)
}

export function stripDays(start: number): Array<number> {
  return Array.from({ length: STRIP_DAYS }, (_, index) => start + index)
}
