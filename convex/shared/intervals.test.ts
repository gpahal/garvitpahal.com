import { expect, test } from 'vitest'

import { INTERVAL_KINDS } from './goalRules'
import { dayOfLocal, intervalOfDay, isInRange } from './intervals'

test('keeps a calendar week, month and year whole', () => {
  // An ISO week that crosses the year.
  expect(intervalOfDay('weekly', dayOfLocal(Date.parse('2027-01-01T00:00:00Z')))).toEqual({
    start: Date.parse('2026-12-28T00:00:00Z'),
    end: Date.parse('2027-01-04T00:00:00Z'),
  })
  const day = dayOfLocal(Date.parse('2025-12-15T00:00:00Z'))
  expect(intervalOfDay('monthly', day)).toEqual({
    start: Date.parse('2025-12-01T00:00:00Z'),
    end: Date.parse('2026-01-01T00:00:00Z'),
  })
  expect(intervalOfDay('yearly', day)).toEqual({
    start: Date.parse('2025-01-01T00:00:00Z'),
    end: Date.parse('2026-01-01T00:00:00Z'),
  })
})

test('uses half-open boundaries for every kind', () => {
  for (const kind of INTERVAL_KINDS) {
    const interval = intervalOfDay(kind, dayOfLocal(Date.parse('2028-02-29T12:00:00Z')))
    expect(isInRange(interval, interval.start)).toBe(true)
    expect(isInRange(interval, interval.end - 1)).toBe(true)
    expect(isInRange(interval, interval.end)).toBe(false)
  }
})
