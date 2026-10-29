import { expect, test } from 'vitest'

import { dayOfLocal, intervalOfDay } from './intervals'

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
