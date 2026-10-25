import type { IntervalKind } from './goalRules'
import { DAY_MS } from './limits'

export type TimeRange = { start: number; end: number }

export function isInRange(range: TimeRange, value: number): boolean {
  return value >= range.start && value < range.end
}

export function dayOfLocal(atLocal: number): number {
  return Math.floor(atLocal / DAY_MS)
}

export function localRangeOfDay(day: number): TimeRange {
  return { start: day * DAY_MS, end: (day + 1) * DAY_MS }
}

/**
 * Local day 0 is 1 January 1970, a Thursday.
 */
const EPOCH_ISO_WEEKDAY = 4

/**
 * Monday is 1 and Sunday is 7.
 */
export function isoWeekdayOfDay(day: number): number {
  return ((((day + EPOCH_ISO_WEEKDAY - 1) % 7) + 7) % 7) + 1
}

/**
 * A range of local instants: logs are filed by their frozen local reading, so no zone is needed.
 */
export function intervalOfDay(kind: IntervalKind, day: number): TimeRange {
  const reading = new Date(day * DAY_MS)
  const year = reading.getUTCFullYear()
  const month = reading.getUTCMonth()
  switch (kind) {
    case 'daily': {
      return localRangeOfDay(day)
    }
    case 'weekly': {
      const monday = day - (isoWeekdayOfDay(day) - 1)
      return { start: monday * DAY_MS, end: (monday + 7) * DAY_MS }
    }
    case 'monthly': {
      return { start: Date.UTC(year, month, 1), end: Date.UTC(year, month + 1, 1) }
    }
    case 'yearly': {
      return { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) }
    }
  }
}

/**
 * `month` counts from 1.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}
