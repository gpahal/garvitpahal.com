import {
  CLOCK_TOO_EARLY_ISSUE,
  DAY_MS,
  EARLIEST_LOCAL,
  EARLIEST_YEAR,
  MINUTE_MS,
} from '@convex/shared/limits'
import { dayOfInstant, toLocal } from '@convex/shared/localTime'
import { lastShowDay, SHOW_AT_TOO_LATE_ISSUE } from '@convex/shared/showAt'

import { DATE_TIME_REQUIRED } from './field-errors'
import { localToDateTimeInput } from './time/dates'

const SHOW_AT_TOO_EARLY_ISSUE = `Choose a date in ${EARLIEST_YEAR} or later`

type ShowAtDraft = {
  showAt: number | undefined
  /**
   * An untouched stored time is not checked, since it may be further ahead than a save could set
   * now.
   */
  isKept: boolean
  now: number
  zone: string
}

export function showAtError({ showAt, isKept, now, zone }: ShowAtDraft): string | undefined {
  if (showAt === undefined) {
    return DATE_TIME_REQUIRED
  }
  if (isKept) {
    return undefined
  }
  // Before the date checks, which would otherwise refuse every date against a clock this wrong.
  if (toLocal(now, zone) < EARLIEST_LOCAL) {
    return CLOCK_TOO_EARLY_ISSUE
  }
  if (toLocal(showAt, zone) < EARLIEST_LOCAL) {
    return SHOW_AT_TOO_EARLY_ISSUE
  }
  const lastDay = lastShowDay(dayOfInstant(now, zone))
  return dayOfInstant(showAt, zone) > lastDay ? SHOW_AT_TOO_LATE_ISSUE : undefined
}

/**
 * Checked before offering a new task on a day, so its form does not open on a time it refuses.
 */
export function isShowDayInReach(day: number, today: number): boolean {
  return day <= lastShowDay(today)
}

export function lastShowAtInput(now: number, zone: string): string {
  const lastDay = lastShowDay(dayOfInstant(now, zone))
  return localToDateTimeInput((lastDay + 1) * DAY_MS - MINUTE_MS)
}
