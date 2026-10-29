import { expect, test } from 'vitest'

import { dayOfLocal } from './intervals'
import { lastShowDay, latestShowAt } from './showAt'

function day(date: string): number {
  return dayOfLocal(Date.parse(`${date}T00:00Z`))
}

test('ends the show days on the same date next year, 29 February on the 28th', () => {
  expect(lastShowDay(day('2027-02-28'))).toBe(day('2028-02-28'))
  expect(lastShowDay(day('2028-02-29'))).toBe(day('2029-02-28'))
})

test('puts the latest show-at a calendar year and three days on', () => {
  expect(latestShowAt(Date.parse('2026-09-27T10:15:00Z'))).toBe(Date.parse('2027-09-30T10:15:00Z'))
  expect(latestShowAt(Date.parse('2028-02-29T12:00:00Z'))).toBe(Date.parse('2029-03-04T12:00:00Z'))
})
