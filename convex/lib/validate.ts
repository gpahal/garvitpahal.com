import { ConvexError, v } from 'convex/values'
import type { ObjectType } from 'convex/values'

import { dayOfLocal } from '../shared/intervals'
import {
  CLOCK_TOO_EARLY_ISSUE,
  DAY_MS,
  EARLIEST_INSTANT,
  EARLIEST_LOCAL,
  isWholeWithin,
  MAX_DESCRIPTION_LENGTH,
  MAX_INSTANT,
  MAX_LIST,
  MAX_NAME_LENGTH,
  MINUTE_MS,
  NAME_REQUIRED_ISSUE,
} from '../shared/limits'
import { isNamedTimeZone, MAX_ZONE_NAME_LENGTH, toLocal } from '../shared/localTime'

export function cleanName(name: string): string {
  const trimmed = name.trim()
  if (trimmed === '') {
    throw new ConvexError(NAME_REQUIRED_ISSUE)
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new ConvexError(`A name can be at most ${MAX_NAME_LENGTH} characters`)
  }
  return trimmed
}

/**
 * Trimmed, and `undefined` rather than empty so patching it in clears what was stored.
 */
export function cleanOptionalText(
  text: string | undefined,
  maxLength: number,
  label: string,
): string | undefined {
  const trimmed = text?.trim()
  if (trimmed === undefined || trimmed === '') {
    return undefined
  }
  if (trimmed.length > maxLength) {
    throw new ConvexError(`${label} can be at most ${maxLength.toLocaleString('en-GB')} characters`)
  }
  return trimmed
}

export function cleanDescription(description: string | undefined): string | undefined {
  return cleanOptionalText(description, MAX_DESCRIPTION_LENGTH, 'A description')
}

/**
 * `v.number()` admits `NaN`, the infinities and numbers no `Date` can hold, and one such row would
 * take its whole list down in the browser.
 */
export function assertInstant(at: number, label: string): void {
  if (!(Math.abs(at) <= MAX_INSTANT)) {
    throw new ConvexError(`${label} is not a time`)
  }
}

/**
 * A device's clock can run a little ahead of the server's.
 */
const CLOCK_SLACK_MS = 5 * MINUTE_MS

/**
 * Against the server's clock, which a device cannot set: a log dated ahead would count towards its
 * goal at once, and a task completed ahead would be on no day's record.
 */
export function isAhead(at: number, now = Date.now()): boolean {
  return at > now + CLOCK_SLACK_MS
}

/**
 * Blames the device's clock, as the forms already refuse a time past it. A log's end combined from
 * two tabs' edits is the exception, which `routineLogs.update` words itself.
 */
export function assertNotFuture(at: number, now = Date.now()): void {
  if (isAhead(at, now)) {
    throw new ConvexError(
      "This device's clock is ahead. In its date and time settings, set the correct time, then try again",
    )
  }
}

export function assertListLimit(limit: number): void {
  if (!isWholeWithin(limit, 1, MAX_LIST)) {
    throw new ConvexError(`Limit must be a whole number from 1 to ${MAX_LIST}`)
  }
}

export const dayListArgs = { start: v.number(), end: v.number(), limit: v.number() }

/**
 * An unchecked `NaN` bound would read as an empty result rather than the caller's mistake.
 */
export function assertDayList({ start, end, limit }: ObjectType<typeof dayListArgs>): void {
  assertInstant(start, 'Range start')
  assertInstant(end, 'Range end')
  if (start > end) {
    throw new ConvexError('A range cannot end before it starts')
  }
  assertListLimit(limit)
}

/**
 * From the first day the browser can reach (`reachableDays`) to a leap year short of the instant
 * range, so every interval around the last stays inside it.
 */
const MIN_QUERY_DAY = dayOfLocal(EARLIEST_LOCAL)
const MAX_QUERY_DAY = Math.floor(MAX_INSTANT / DAY_MS) - 366

export function assertQueryDay(day: number): void {
  // A chosen day is never before `EARLIEST_YEAR` (`keptChoice`), so an earlier one is the device
  // clock's today.
  if (Number.isSafeInteger(day) && day < MIN_QUERY_DAY) {
    throw new ConvexError(CLOCK_TOO_EARLY_ISSUE)
  }
  if (!isWholeWithin(day, MIN_QUERY_DAY, MAX_QUERY_DAY)) {
    throw new ConvexError(`Day must be a whole number from ${MIN_QUERY_DAY} to ${MAX_QUERY_DAY}`)
  }
}

/**
 * A new local reading, which files a record under its day for good, so a later zone change leaves
 * it where it was. The caller bounds the instant against the future.
 */
export function assertReading(
  { at, atLocal }: { at: number; atLocal: number },
  timeZone: string,
  label: string,
  tooEarlyIssue: string,
): void {
  // `v.string()` caps no length, so a long zone is refused before `Intl` sees it, and only that much
  // of it is echoed.
  if (!(timeZone.length <= MAX_ZONE_NAME_LENGTH && isNamedTimeZone(timeZone))) {
    const shown =
      timeZone.length > MAX_ZONE_NAME_LENGTH
        ? `${timeZone.slice(0, MAX_ZONE_NAME_LENGTH)}…`
        : timeZone
    throw new ConvexError(
      `"${shown}" is not a time zone this server knows. In this device's date and time settings, choose a named time zone, or a nearby city's if this one is new, then try again`,
    )
  }
  assertInstant(at, label)
  // `toLocal` can misread an instant this early.
  if (at < EARLIEST_INSTANT) {
    throw new ConvexError(tooEarlyIssue)
  }
  // A device whose tzdata disagrees hears so rather than filing under the wrong day. Either side's
  // tzdata can be the older one, so the refusal offers a way out for each.
  if (atLocal !== toLocal(at, timeZone)) {
    throw new ConvexError(
      `This device's time zone data for ${timeZone} does not match the server's. Update this browser or operating system so its time zone data is current, then try again. If it is already current, the server's data may be older: until it catches up, set this device to a zone that shows the same time`,
    )
  }
  // Bounded here because the reading and its instant agree however wrong the device clock is.
  if (atLocal < EARLIEST_LOCAL) {
    throw new ConvexError(tooEarlyIssue)
  }
}
