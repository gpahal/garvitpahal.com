import { describe, expect, it } from 'vitest'

import type { Goal } from '../schema'
import { goalIssue, reminderSlotKey } from './goalRules'

describe('reminderSlotKey', () => {
  it('reads only the fields its kind uses, so what the editor left behind says nothing', () => {
    const noon = { minuteOfDay: 720 }
    expect(reminderSlotKey('daily', { ...noon, weekday: 3, day: 9, month: 4 })).toBe(
      reminderSlotKey('daily', noon),
    )
    expect(reminderSlotKey('weekly', { ...noon, weekday: 3, day: 9 })).toBe(
      reminderSlotKey('weekly', { ...noon, weekday: 3 }),
    )
  })
})

const daily = (count: number, minuteOfDay: Array<number>): Goal => ({
  kind: 'daily',
  count,
  reminders: minuteOfDay.map((m) => ({ minuteOfDay: m })),
})

const NOON = 12 * 60

describe('goalIssue', () => {
  it('refuses two of the same nudge', () => {
    expect(goalIssue(daily(2, [NOON, NOON]))).toBe(
      'Two reminders are the same. Change or remove one of them',
    )
  })

  it('names the range, not the match, when two identical reminders are out of it', () => {
    expect(goalIssue(daily(2, [1440, 1440]))).toBe('Reminder time is not a time of day')
    const goal: Goal = {
      kind: 'weekly',
      count: 2,
      reminders: [
        { weekday: 8, minuteOfDay: NOON },
        { weekday: 8, minuteOfDay: NOON },
      ],
    }
    expect(goalIssue(goal)).toBe('Weekday must be from 1 (Monday) to 7 (Sunday)')
  })
})
