import { dayOfLocal } from '@convex/shared/intervals'
import { DAY_MS, EARLIEST_LOCAL } from '@convex/shared/limits'

import { AGENDA_PATHS } from './routes'
import { dayOfIsoDate, isoDateOfDay } from './time/dates'

export const DAY_PARAM = 'day'

/**
 * `undefined` links to today.
 */
export function dayHref(choice: number | undefined): string {
  return choice === undefined
    ? AGENDA_PATHS.agenda
    : `${AGENDA_PATHS.agenda}?${DAY_PARAM}=${isoDateOfDay(choice)}`
}

/**
 * A value that names no date is no choice. Whether the day is in reach is `keptChoice`'s to judge.
 */
export function dayOfParam(value: string | null): number | undefined {
  return value === null ? undefined : dayOfIsoDate(value)
}

export function withDayParam(href: string, choice: number | undefined): string {
  const url = new URL(href)
  if (choice === undefined) {
    url.searchParams.delete(DAY_PARAM)
  } else {
    url.searchParams.set(DAY_PARAM, isoDateOfDay(choice))
  }
  return url.href
}

/**
 * The date input's `max` has to end somewhere.
 */
const YEARS_AHEAD = 10

/**
 * The strip, the URL and the date input share these bounds.
 */
export function reachableDays(today: number): { first: number; last: number } {
  const lastYear = new Date(today * DAY_MS).getUTCFullYear() + YEARS_AHEAD
  return {
    first: dayOfLocal(EARLIEST_LOCAL),
    last: Date.UTC(lastYear, 11, 31) / DAY_MS,
  }
}

/**
 * Clamped to the reachable bounds, so the days in between are still a step away.
 */
export function dayAWeekAway(
  day: number,
  weeks: -1 | 1,
  { first, last }: ReturnType<typeof reachableDays>,
): number {
  return Math.min(Math.max(day + weeks * 7, first), last)
}

/**
 * Today is the absence of a choice; a day out of reach, such as one typed into the URL, is dropped.
 */
export function keptChoice(chosen: number | undefined, today: number): number | undefined {
  if (chosen === undefined || chosen === today) {
    return undefined
  }
  const { first, last } = reachableDays(today)
  return chosen < first || chosen > last ? undefined : chosen
}
