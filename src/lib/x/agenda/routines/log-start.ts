import { dayOfLocal, localRangeOfDay } from '@convex/shared/intervals'
import type { TimeRange } from '@convex/shared/intervals'
import { DAY_MS, MINUTE_MS } from '@convex/shared/limits'
import { toLocal } from '@convex/shared/localTime'

import { fromLocal } from '../time/dates'

/**
 * Today's default ends now and may start back to the interval's beginning. An earlier day's ends at
 * the current local time of day and starts no earlier than that day.
 */
function logWindow(
  day: number,
  interval: TimeRange,
  now: number,
  timeZone: string,
): { finished: number; earliest: number } {
  const nowLocal = toLocal(now, timeZone)
  const { start: dayStart } = localRangeOfDay(day)
  const isToday = dayOfLocal(nowLocal) === day
  const finished = isToday
    ? now
    : fromLocal(dayStart + (nowLocal - dayOfLocal(nowLocal) * DAY_MS), timeZone)
  return { finished, earliest: fromLocal(isToday ? interval.start : dayStart, timeZone) }
}

/**
 * The duration comes off the instant, not the reading: across a clock change a reading one duration
 * back can be one that never happened, or the wrong one of two that did.
 */
export function defaultLogStart(
  day: number,
  interval: TimeRange,
  minutesEach: number | undefined,
  now: number,
  timeZone: string,
): number {
  const { finished, earliest } = logWindow(day, interval, now, timeZone)
  return Math.max(finished - (minutesEach ?? 0) * MINUTE_MS, earliest)
}

/**
 * The goal's minutes, cut to what fits between the earliest start and now, so the form never opens
 * on a log that ends in the future.
 */
export function defaultLogMinutes(
  day: number,
  interval: TimeRange,
  minutesEach: number,
  now: number,
  timeZone: string,
): number {
  const { earliest } = logWindow(day, interval, now, timeZone)
  const fits = Math.max(1, Math.floor((now - earliest) / MINUTE_MS))
  return Math.min(minutesEach, fits)
}
