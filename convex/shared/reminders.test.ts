import { describe, expect, it } from 'vitest'

import type { Doc } from '../_generated/dataModel'
import type { Goal } from '../schema'
import { spanMs } from './goalRules'
import type { IntervalKind } from './goalRules'
import { dayOfLocal, intervalOfDay, isInRange } from './intervals'
import type { TimeRange } from './intervals'
import { MINUTE_MS } from './limits'
import { fromLocal, toLocal } from './localTime'
import { nextReminderAt, remindersElapsed, routineStatusOf } from './reminders'
import type { ScheduledRoutine } from './reminders'

const KOLKATA = 'Asia/Kolkata'
const NEW_YORK = 'America/New_York'

/**
 * A wall-clock reading, written as if UTC.
 */
function local(iso: string): number {
  return Date.parse(`${iso}Z`)
}

function intervalOf(kind: IntervalKind, at: number, timeZone: string): TimeRange {
  return intervalOfDay(kind, dayOfLocal(toLocal(at, timeZone)))
}

type LoggedSpan = Pick<Doc<'routineLogs'>, 'started' | 'ended'>

function statusAt(scheduled: ScheduledRoutine, logs: Array<LoggedSpan>, now: number, zone: string) {
  const interval = intervalOf(scheduled.goal.kind, now, zone)
  const matching = logs.filter(({ started }) => isInRange(interval, started.atLocal))
  const totals = {
    count: matching.length,
    loggedMs: matching.reduce((sum, log) => sum + spanMs(log), 0),
  }
  return routineStatusOf(scheduled, totals, interval, now, zone)
}

function elapsedAt(scheduled: ScheduledRoutine, now: number, zone: string): number {
  return remindersElapsed(scheduled, intervalOf(scheduled.goal.kind, now, zone), now, zone)
}

function kolkata(iso: string): number {
  return Date.parse(`${iso}+05:30`)
}

function routine(goal: Goal, span: { createdAt?: number; archivedAt?: number } = {}) {
  const { createdAt = 0, ...rest } = span
  return { _creationTime: createdAt, ...rest, goal } satisfies ScheduledRoutine
}

function logged(startedLocal: string, minutes: number): LoggedSpan {
  const atLocal = local(startedLocal)
  const at = fromLocal(atLocal, KOLKATA)
  return { started: { at, atLocal }, ended: { at: at + minutes * MINUTE_MS } }
}

function firedBy(goal: Goal, iso: string, secondsEarlier = 0): number {
  return elapsedAt(routine(goal), kolkata(iso) - secondsEarlier * 1000, KOLKATA)
}

/**
 * Fires at exactly this Kolkata reading, not a second before.
 */
function willFireAt(goal: Goal, iso: string): boolean {
  return firedBy(goal, iso, 1) === 0 && firedBy(goal, iso) === 1
}

function monthly(day: number): Goal {
  return { kind: 'monthly', count: 1, reminders: [{ day, minuteOfDay: 540 }] }
}

function yearly(month: number, day: number): Goal {
  return { kind: 'yearly', count: 1, reminders: [{ month, day, minuteOfDay: 540 }] }
}

describe('when a reminder fires', () => {
  it.each([
    ['the last day of a 28-day month', monthly(-1), '2026-02-28T09:00:00'],
    ['29 February in a leap year', yearly(2, 29), '2028-02-29T09:00:00'],
  ])('fires on %s', (_, goal, iso) => {
    expect(willFireAt(goal, iso)).toBe(true)
  })

  it.each([
    ['the 31st of a 30-day month', monthly(31), '2026-04-30T23:59:59'],
    ['29 February in a year without one', yearly(2, 29), '2026-12-31T23:59:59'],
  ])('skips %s rather than shifting it', (_, goal, iso) => {
    expect(firedBy(goal, iso)).toBe(0)
  })

  it('keeps two reminders that meet in this interval only as two nudges', () => {
    const goal: Goal = {
      kind: 'monthly',
      count: 2,
      reminders: [
        { day: 31, minuteOfDay: 540 },
        { day: -1, minuteOfDay: 540 },
      ],
    }
    // October's 31st is its last day; September has a last day and no 31st.
    expect(firedBy(goal, '2026-10-31T09:00:00')).toBe(2)
    expect(firedBy(goal, '2026-09-30T23:59:59')).toBe(1)
  })
})

describe('routineStatusOf', () => {
  // The week of Monday 14 September 2026, nudged on Monday, Wednesday and Friday at 09:00.
  const threeAWeek: Goal = {
    kind: 'weekly',
    count: 3,
    reminders: [
      { weekday: 1, minuteOfDay: 540 },
      { weekday: 3, minuteOfDay: 540 },
      { weekday: 5, minuteOfDay: 540 },
    ],
  }

  it('does not back-fill reminders from before the routine existed', () => {
    const created = routine(threeAWeek, { createdAt: kolkata('2026-09-16T12:00:00') })
    expect(elapsedAt(created, kolkata('2026-09-17T10:00:00'), KOLKATA)).toBe(0)
    expect(elapsedAt(created, kolkata('2026-09-18T10:00:00'), KOLKATA)).toBe(1)
    const atTheNudge = routine(threeAWeek, { createdAt: kolkata('2026-09-16T09:00:00') })
    expect(elapsedAt(atTheNudge, kolkata('2026-09-16T09:00:00'), KOLKATA)).toBe(1)
  })

  it('stops reminders at the archive, leaving out one that fires at that instant', () => {
    const saturday = kolkata('2026-09-19T10:00:00')
    const archived = routine(threeAWeek, { archivedAt: kolkata('2026-09-17T12:00:00') })
    expect(elapsedAt(archived, saturday, KOLKATA)).toBe(2)
    const atTheNudge = routine(threeAWeek, { archivedAt: kolkata('2026-09-16T09:00:00') })
    expect(elapsedAt(atTheNudge, saturday, KOLKATA)).toBe(1)
  })

  it('owes the elapsed reminders less what is done, never more than the goal or below zero', () => {
    const owed = (logs: Array<LoggedSpan>, now: string) =>
      statusAt(routine(threeAWeek), logs, kolkata(now), KOLKATA).owed
    expect(owed([], '2026-09-14T08:59:00')).toBe(0)
    expect(owed([], '2026-09-14T09:00:00')).toBe(1)
    expect(owed([logged('2026-09-14T10:00:00', 0)], '2026-09-16T10:00:00')).toBe(1)
    const four = [14, 15, 16, 17].map((day) => logged(`2026-09-${day}T10:00:00`, 0))
    expect(owed(four, '2026-09-18T10:00:00')).toBe(0)
  })
})

describe('nextReminderAt', () => {
  function next(goal: Goal, iso: string, zone = KOLKATA): string | undefined {
    const at = nextReminderAt(goal, kolkata(iso), zone)
    return at === undefined ? undefined : new Date(at).toISOString()
  }

  it('takes the first reminder strictly after the instant, later today or on a later day', () => {
    const daily: Goal = {
      kind: 'daily',
      count: 2,
      reminders: [{ minuteOfDay: 1080 }, { minuteOfDay: 540 }],
    }
    expect(next(daily, '2026-09-18T08:00:00')).toBe('2026-09-18T03:30:00.000Z')
    // A reminder that fires at this very instant is the one just sent, not the next.
    expect(next(daily, '2026-09-18T09:00:00')).toBe('2026-09-18T12:30:00.000Z')
    expect(next(daily, '2026-09-18T18:00:00')).toBe('2026-09-19T03:30:00.000Z')
  })

  it('agrees with remindersElapsed on which days a reminder falls', () => {
    // 18 September 2026 is a Friday.
    const weekly: Goal = { kind: 'weekly', count: 1, reminders: [{ weekday: 1, minuteOfDay: 540 }] }
    expect(next(weekly, '2026-09-18T10:00:00')).toBe('2026-09-21T03:30:00.000Z')
    // The last day of the month, skipping none.
    expect(next(monthly(-1), '2026-09-30T10:00:00')).toBe('2026-10-31T03:30:00.000Z')
    // A month without a 31st has no reminder rather than one on the 30th.
    expect(next(monthly(31), '2026-08-31T10:00:00')).toBe('2026-10-31T03:30:00.000Z')
    expect(next(yearly(2, 29), '2026-09-18T10:00:00')).toBe('2028-02-29T03:30:00.000Z')
  })

  it('fires a reminder in a clocks-forward gap at the change', () => {
    // 8 Mar 2026: 02:00 EST jumps to 03:00 EDT at 07:00Z, so 02:30 never happens.
    const daily: Goal = { kind: 'daily', count: 1, reminders: [{ minuteOfDay: 150 }] }
    const at = nextReminderAt(daily, Date.parse('2026-03-08T05:00:00Z'), NEW_YORK)
    expect(at).toBe(Date.parse('2026-03-08T07:00:00Z'))
  })
})
