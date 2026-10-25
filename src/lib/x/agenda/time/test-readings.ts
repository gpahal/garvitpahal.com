import type { IntervalKind } from '@convex/shared/goalRules'
import { dayOfLocal, intervalOfDay } from '@convex/shared/intervals'
import type { TimeRange } from '@convex/shared/intervals'
import { toLocal } from '@convex/shared/localTime'

/**
 * No clock changes, and not a whole hour from UTC.
 */
export const KOLKATA = 'Asia/Kolkata'
/**
 * Clocks forward in March and back in November.
 */
export const NEW_YORK = 'America/New_York'

export function local(iso: string): number {
  return Date.parse(`${iso}Z`)
}

export function intervalOf(kind: IntervalKind, at: number, timeZone: string): TimeRange {
  return intervalOfDay(kind, dayOfLocal(toLocal(at, timeZone)))
}
