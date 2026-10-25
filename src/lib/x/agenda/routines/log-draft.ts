import { logDurationIssue, logLengthIssue, spanMs } from '@convex/shared/goalRules'
import type { IntervalKind } from '@convex/shared/goalRules'
import {
  EARLIEST_LOCAL,
  LOG_ENDS_AHEAD_ISSUE,
  LOG_TOO_EARLY_ISSUE,
  MINUTE_MS,
} from '@convex/shared/limits'
import { toLocal } from '@convex/shared/localTime'

import type { RoutineLog } from '../doc-types'
import { DATE_TIME_REQUIRED } from '../field-errors'
import { parseDuration } from './duration-boxes'
import type { DurationBoxes, DurationUnit } from './duration-boxes'

type LogDraft = {
  log: RoutineLog | undefined
  /**
   * The goal's interval as the form opened, which bounds a log's length.
   */
  kind: IntervalKind
  hasDurationField: boolean
  startedAt: number | undefined
  isStartUntouched: boolean
  duration: DurationBoxes
  isDurationUntouched: boolean
  zone: string
  now: number
}

type ParsedLogDraft = {
  /**
   * The stored log while its start is kept exactly: instant, reading and zone.
   */
  keptStart: RoutineLog | undefined
  startError: string | undefined
  durationError: string | undefined
  durationBoxErrors: Partial<Record<DurationUnit, string>>
  fields: Pick<RoutineLog, 'started' | 'ended' | 'timeZone'> | undefined
  /**
   * Sent by a correction in place of an end; `undefined` while the stored length is kept.
   */
  changedLengthMs: number | undefined
}

function checkStart(
  startedAt: number | undefined,
  keptStart: RoutineLog | undefined,
  latest: number,
  zone: string,
): { issue: string | undefined; isAhead: boolean } {
  if (startedAt === undefined) {
    return { issue: DATE_TIME_REQUIRED, isAhead: false }
  }
  // A kept start was checked when it was stored.
  if (keptStart) {
    return { issue: undefined, isAhead: false }
  }
  if (startedAt > latest) {
    return { issue: 'A log cannot start in the future', isAhead: true }
  }
  // No screen reaches a day before this, so a log with a mistyped year could never be found again.
  return {
    issue: toLocal(startedAt, zone) < EARLIEST_LOCAL ? LOG_TOO_EARLY_ISSUE : undefined,
    isAhead: false,
  }
}

/**
 * As on the server, only what this save changes is checked. An untouched length is kept exactly,
 * since a stored one need not fit the boxes if the goal has changed. A changed start restamps the
 * log with the form's zone.
 */
export function parseLogDraft({
  log,
  kind,
  hasDurationField,
  startedAt,
  isStartUntouched,
  duration,
  isDurationUntouched,
  zone,
  now,
}: LogDraft): ParsedLogDraft {
  const keptStart = log && isStartUntouched ? log : undefined
  const isSpanKept = !hasDurationField || (log !== undefined && isDurationUntouched)
  const { minutes, errors } = parseDuration(kind, duration)
  const durationBoxErrors = isSpanKept ? {} : errors
  const lengthMs = isSpanKept ? (log ? spanMs(log) : 0) : (minutes ?? 0) * MINUTE_MS
  // `now` is floored to the minute; the server refuses a future log against its own clock.
  const latest = now + MINUTE_MS
  const start = checkStart(startedAt, keptStart, latest, zone)
  const isEndSet = !(keptStart && isSpanKept)
  const isEndAhead = isEndSet && startedAt !== undefined && startedAt + lengthMs > latest
  // Shown on the field that sets the end: the duration when the form has one, else the start.
  const endError =
    (isSpanKept ? undefined : logDurationIssue(hasDurationField, lengthMs)) ??
    (isEndSet ? logLengthIssue(kind, lengthMs) : undefined) ??
    (isEndAhead && !start.isAhead ? LOG_ENDS_AHEAD_ISSUE : undefined)
  const startError = start.issue ?? (hasDurationField ? undefined : endError)
  // A box out of range has its own message and leaves no length to judge.
  const durationError =
    !hasDurationField || (!isSpanKept && minutes === undefined) ? undefined : endError
  const hasError =
    startError !== undefined ||
    durationError !== undefined ||
    Object.keys(durationBoxErrors).length > 0
  return {
    keptStart,
    startError,
    durationError,
    durationBoxErrors,
    changedLengthMs: isSpanKept ? undefined : lengthMs,
    fields:
      startedAt === undefined || hasError
        ? undefined
        : {
            started: keptStart?.started ?? { at: startedAt, atLocal: toLocal(startedAt, zone) },
            ended: { at: startedAt + lengthMs },
            timeZone: keptStart?.timeZone ?? zone,
          },
  }
}
