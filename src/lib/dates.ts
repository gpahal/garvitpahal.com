import { z } from 'zod'

import { MONTHS } from '@/lib/months'

const INVALID_DATE_MESSAGE = 'Invalid date: use the format 13/02/2022'

/**
 * A date-only `YYYY-MM-DD` string, never an instant, so no zone can shift it. Convert with
 * `dateOnlyToUtc` only where a timestamp is required.
 */
export const contentDateSchema = z
  .string()
  .regex(/^\d{2}\/\d{2}\/\d{4}$/, INVALID_DATE_MESSAGE)
  .transform((value, ctx) => {
    const [day = '', month = '', year = ''] = value.split('/', 3)
    const iso = `${year}-${month}-${day}`
    const instant = new Date(`${iso}T00:00:00.000Z`)
    // The round trip rejects days a month lacks, which `Date` would roll into the next month.
    if (Number.isNaN(instant.getTime()) || instant.toISOString().slice(0, 10) !== iso) {
      ctx.addIssue({ code: 'custom', message: INVALID_DATE_MESSAGE })
      return z.NEVER
    }
    return iso
  })
  .brand<'DateOnly'>()

export type DateOnly = z.infer<typeof contentDateSchema>

export function dateOnlyToUtc(date: DateOnly): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

/**
 * Read from the string rather than a `Date`, so no time zone can move the month.
 */
export function formatMonthYear(date: DateOnly): string {
  const [year = '', month] = date.split('-', 2)
  return `${MONTHS[Number(month) - 1] ?? ''} ${year}`
}

/**
 * Newest first. Entries on the same date fall back to their ids, so every build orders them alike.
 * Code units rather than `localeCompare`, whose order can differ between runtimes and locales.
 */
export function sortNewestFirst<T>(
  items: ReadonlyArray<T>,
  keyOf: (item: T) => { date: DateOnly; id: string },
): Array<T> {
  return items.toSorted((a, b) => {
    const [keyA, keyB] = [keyOf(a), keyOf(b)]
    const byDate = compareCodeUnits(keyB.date, keyA.date)
    return byDate === 0 ? compareCodeUnits(keyA.id, keyB.id) : byDate
  })
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function formatMonthRange(startedOn: DateOnly, endedOn: DateOnly | undefined): string {
  return `${formatMonthYear(startedOn)} – ${endedOn ? formatMonthYear(endedOn) : 'Present'}`
}

/**
 * For dates known only to the year: one year when it starts and ends in the same one.
 */
export function formatYearRange(startedOn: DateOnly, endedOn: DateOnly | undefined): string {
  const [start, end] = [startedOn.slice(0, 4), endedOn?.slice(0, 4)]
  return end === undefined ? `${start} – Present` : end === start ? start : `${start} – ${end}`
}

export type Period = { startedOn: DateOnly; endedOn?: DateOnly }

/**
 * An entry's latest period, then its earlier ones: `startedOn` and `endedOn` stay the latest, so
 * sorting by `startedOn` puts a resumed role where it is current.
 */
export function periodsOf(
  entry: Period & { earlierPeriods?: ReadonlyArray<Period> },
): Array<Period> {
  return [{ startedOn: entry.startedOn, endedOn: entry.endedOn }, ...(entry.earlierPeriods ?? [])]
}

/**
 * Newest first: each period ends no earlier than it starts and before the newer one starts, and
 * only the newest may be open. ISO date strings order like the dates they name.
 */
export function arePeriodsInOrder(periods: ReadonlyArray<Period>): boolean {
  return periods.every((period, i) => {
    const newer = periods[i - 1]
    if (period.endedOn === undefined) {
      return newer === undefined
    }
    return (
      period.endedOn >= period.startedOn &&
      (newer === undefined || period.endedOn < newer.startedOn)
    )
  })
}

export function formatPeriods(periods: ReadonlyArray<Period>): string {
  return periods.map(({ startedOn, endedOn }) => formatMonthRange(startedOn, endedOn)).join(', ')
}
