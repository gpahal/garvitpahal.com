import { describe, expect, it } from 'vitest'

import { CLOCK_TOO_EARLY_ISSUE, MINUTE_MS } from '@convex/shared/limits'
import { latestShowAt } from '@convex/shared/showAt'

import { lastShowAtInput, showAtError } from './task-show-at'
import { fromLocal } from './time/dates'
import { local } from './time/test-readings'

describe('lastShowAtInput', () => {
  // The server has no zone for a task, so its bound has to reach past the form's in every zone.
  it.each([
    '2026-09-28T00:00:00Z',
    // The tightest, a day inside `latestShowAt` in Kiritimati.
    '2027-02-28T10:00:00Z',
    '2028-02-29T13:00:00Z',
  ])("stays within the server's bound in the zones furthest from UTC at %s", (iso) => {
    const now = Date.parse(iso)
    for (const zone of ['Pacific/Kiritimati', 'Etc/GMT+12', 'UTC']) {
      const last = fromLocal(local(lastShowAtInput(now, zone)), zone) + MINUTE_MS - 1
      expect(last, zone).toBeLessThanOrEqual(latestShowAt(now))
    }
  })
})

describe('showAtError', () => {
  it('blames a clock set before 2025, not the date, for a time a save sets', () => {
    const now = Date.UTC(2023, 5, 1)
    const showAt = Date.UTC(2025, 5, 1)
    expect(showAtError({ showAt, isKept: false, now, zone: 'UTC' })).toBe(CLOCK_TOO_EARLY_ISSUE)
    expect(showAtError({ showAt, isKept: true, now, zone: 'UTC' })).toBeUndefined()
  })
})
