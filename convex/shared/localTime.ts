import { SECOND_MS } from './limits'

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
