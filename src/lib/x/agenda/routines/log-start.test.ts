import { describe, expect, it } from 'vitest'

import { dayOfInstant } from '@convex/shared/localTime'

import { intervalOf, KOLKATA, NEW_YORK } from '../time/test-readings'
import { defaultLogMinutes, defaultLogStart } from './log-start'

describe('defaultLogStart', () => {
  it('takes the duration off the instant across a clocks-forward gap', () => {
    // 03:15 EDT, a quarter of an hour after 02:00 EST became 03:00 EDT: 02:45 never happened.
    const now = Date.parse('2026-03-08T03:15:00-04:00')
    const day = dayOfInstant(now, NEW_YORK)
    expect(defaultLogStart(day, intervalOf('daily', now, NEW_YORK), 30, now, NEW_YORK)).toBe(
      Date.parse('2026-03-08T01:45:00-05:00'),
    )
  })
})

describe('an earlier day', () => {
  // Logging on Monday or Tuesday from Wednesday 16 September 2026, in a week that began on Monday.
  const onWednesday = (time: string) => Date.parse(`2026-09-16T${time}:00+05:30`)
  const monday = dayOfInstant(onWednesday('12:00'), KOLKATA) - 2
  const week = intervalOf('weekly', onWednesday('12:00'), KOLKATA)

  it('is cut short to end at now when the goal would run past it', () => {
    // 1 day 12 hrs logged on Tuesday from Wednesday at 10:00, 34 hours after Tuesday began.
    const now = onWednesday('10:00')
    const minutes = defaultLogMinutes(monday + 1, week, 36 * 60, now, KOLKATA)
    expect(minutes).toBe(34 * 60)
    const start = defaultLogStart(monday + 1, week, minutes, now, KOLKATA)
    expect(start).toBe(Date.parse('2026-09-15T00:00:00+05:30'))
    expect(start + minutes * 60_000).toBe(now)
  })
})
