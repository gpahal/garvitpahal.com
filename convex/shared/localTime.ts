import { dayOfLocal, localRangeOfDay } from './intervals'
import type { TimeRange } from './intervals'
import { DAY_MS, SECOND_MS } from './limits'

/**
 * Longer than any IANA name, so a longer string is never a zone.
 */
export const MAX_ZONE_NAME_LENGTH = 64

/**
 * Unbounded: only the owner reaches the server's, with zones capped in length, and the browser asks
 * only about its own and stored zones.
 */
const formatters = new Map<string, Intl.DateTimeFormat>()

/**
 * Throws a `RangeError` for a zone this runtime's tzdata does not have.
 */
function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

/**
 * Each side asks its own runtime, whose tzdata can differ. Offsets such as `+05:30` are refused
 * because an older engine could not show a record stored with one; the resolved zone is checked, as
 * `Intl` takes offsets spelled other ways too.
 */
export function isNamedTimeZone(timeZone: string): boolean {
  try {
    return !/^[+-]/.test(zoneFormatter(timeZone).resolvedOptions().timeZone)
  } catch {
    return false
  }
}

/**
 * Wrong before year 100 and for BC years, which no reading reaches (`EARLIEST_INSTANT`).
 */
export function offsetAt(at: number, timeZone: string): number {
  // `Intl` has no milliseconds, and offsets are whole seconds.
  const second = Math.floor(at / SECOND_MS) * SECOND_MS
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const { type, value } of zoneFormatter(timeZone).formatToParts(second)) {
    parts[type] = value
  }
  const reading = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return reading - second
}

export function toLocal(at: number, timeZone: string): number {
  return at + offsetAt(at, timeZone)
}

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
