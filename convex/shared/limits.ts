/**
 * A read limit never hides a row: the result says when it was cut.
 */

export function isWholeWithin(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max
}

export const SECOND_MS = 1000
export const MINUTE_MS = 60_000
export const DAY_MS = 86_400_000
export const DAY_MINUTES = 1440

/**
 * A day inside `Date`'s bounds leaves room for an instant's local reading.
 */
export const MAX_INSTANT = 8.64e15 - DAY_MS

/**
 * Day navigation starts here, so an earlier reading from a mistyped year or a wrong clock would be
 * filed under a day no screen can reach.
 */
export const EARLIEST_YEAR = 2025
export const EARLIEST_LOCAL = Date.UTC(EARLIEST_YEAR, 0, 1)

/**
 * No zone is a day ahead of UTC, so an earlier instant reads before `EARLIEST_LOCAL` in every zone.
 * The server's floor for an instant with no zone.
 */
export const EARLIEST_INSTANT = EARLIEST_LOCAL - DAY_MS

/**
 * For a time read from the device's clock, such as 'Mark done' or 'Immediately', or a day it
 * makes today.
 */
export const CLOCK_TOO_EARLY_ISSUE = `This device's clock is set before ${EARLIEST_YEAR}. In its date and time settings, set the correct time, then try again`

export const LOG_TOO_EARLY_ISSUE = `A log cannot start before ${EARLIEST_YEAR}`
export const LOG_ENDS_AHEAD_ISSUE = 'A log cannot end in the future'
export const NAME_REQUIRED_ISSUE = 'Enter a name'

/**
 * UTF-16 units, at most three bytes each, so a list of `MAX_LIST` tasks stays under 7 MB, inside a
 * transaction's 16 MiB read limit. No list reads notes.
 */
export const MAX_NAME_LENGTH = 200
export const MAX_DESCRIPTION_LENGTH = 2000
export const MAX_NOTE_LENGTH = 10_000

/**
 * Archived routines count too, as every routine is always read and the list is never cut.
 */
export const MAX_ROUTINES = 100

/**
 * Warn while there is still room to act.
 */
export const ROUTINE_WARNING_COUNT = Math.ceil(MAX_ROUTINES * 0.8)

export const ROUTINES_FULL_ISSUE = `There is room for ${MAX_ROUTINES} routines, counting archived ones. To make room, archive one and then delete it`

export const MAX_GOAL_COUNT = 50
export const MAX_REMINDERS = 100

/**
 * Caps the dialog's rows only; a cut read takes its totals from the aggregate.
 */
export const INTERVAL_LOGS_READ = 100

/**
 * Bounds one read of a list with no stored maximum, which 'Load more' grows a step at a time. Not
 * paginated, as a reactive page keeps its first bounds and is never topped up.
 */
export const MAX_LIST = 1000

export const LIST_GROWTH = { step: 100, max: MAX_LIST }

/**
 * Admissions puzzle reads may spend at once, enough for one full read and an immediate Try again.
 */
export const PUZZLE_READS_BURST = 10
