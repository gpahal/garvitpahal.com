import { describe, expect, it } from 'vitest'

import type { Goal } from '../schema'
import { goalIssue } from './goalRules'

const daily = (count: number, minuteOfDay: Array<number>): Goal => ({
  kind: 'daily',
  count,
  reminders: minuteOfDay.map((m) => ({ minuteOfDay: m })),
})

const NOON = 12 * 60

describe('goalIssue', () => {
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
