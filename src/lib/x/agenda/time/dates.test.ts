import { describe, expect, it } from 'vitest'

import { dayOfLocal } from '@convex/shared/intervals'
import { toLocal } from '@convex/shared/localTime'

import { dayOfInstant, dayOfMonth, fromDateTimeInput, fromLocal, instantRangeOfDay } from './dates'
import { KOLKATA, local, NEW_YORK } from './test-readings'

const HOUR_MS = 3_600_000

const LORD_HOWE = 'Australia/Lord_Howe'
const SANTIAGO = 'America/Santiago'

describe('fromLocal', () => {
  it('inverts toLocal away from a clock change', () => {
    for (const timeZone of [KOLKATA, NEW_YORK, LORD_HOWE, 'Pacific/Kiritimati']) {
      const at = Date.parse('2026-05-04T21:17:05.250Z')
      expect(fromLocal(toLocal(at, timeZone), timeZone)).toBe(at)
    }
  })

  it('resolves a time in a clocks-forward gap to the next real instant', () => {
    // 8 Mar 2026: 02:00 EST jumps to 03:00 EDT at 07:00Z, so 02:30 never happens.
    const transition = Date.parse('2026-03-08T07:00:00Z')
    expect(fromLocal(local('2026-03-08T02:30:00'), NEW_YORK)).toBe(transition)
    expect(fromLocal(local('2026-03-08T02:00:00'), NEW_YORK)).toBe(transition)
    expect(fromLocal(local('2026-03-08T02:59:59.999'), NEW_YORK)).toBe(transition)
    expect(toLocal(transition, NEW_YORK)).toBe(local('2026-03-08T03:00:00'))
  })

  it('resolves a time in a clocks-back repeat to the first occurrence', () => {
    // 1 Nov 2026: 02:00 EDT falls back to 01:00 EST at 06:00Z, so 01:30 happens twice.
    expect(fromLocal(local('2026-11-01T01:30:00'), NEW_YORK)).toBe(
      Date.parse('2026-11-01T05:30:00Z'),
    )
    expect(fromLocal(local('2026-11-01T01:00:00'), NEW_YORK)).toBe(
      Date.parse('2026-11-01T05:00:00Z'),
    )
    // 02:00 only happens once, after the repeat.
    expect(fromLocal(local('2026-11-01T02:00:00'), NEW_YORK)).toBe(
      Date.parse('2026-11-01T07:00:00Z'),
    )
  })
})

describe('day ranges', () => {
  it('makes a clock-change day 23 or 25 real hours long', () => {
    const forward = instantRangeOfDay(dayOfLocal(local('2026-03-08T12:00:00')), NEW_YORK)
    expect(forward.end - forward.start).toBe(23 * HOUR_MS)
    const back = instantRangeOfDay(dayOfLocal(local('2026-11-01T12:00:00')), NEW_YORK)
    expect(back.end - back.start).toBe(25 * HOUR_MS)
  })

  it('starts a day whose midnight does not exist at the first real instant', () => {
    // Santiago springs forward at midnight: 6 Sep 2026 00:00 -04 jumps to 01:00 -03 at 04:00Z.
    const day = dayOfLocal(local('2026-09-06T12:00:00'))
    const range = instantRangeOfDay(day, SANTIAGO)
    expect(range.start).toBe(Date.parse('2026-09-06T04:00:00Z'))
    expect(range.end - range.start).toBe(23 * HOUR_MS)
    expect(dayOfInstant(range.start, SANTIAGO)).toBe(day)
    expect(dayOfInstant(range.start - 1, SANTIAGO)).toBe(day - 1)
  })
})

describe('fromDateTimeInput', () => {
  it('has no instant for a partial or impossible value, nor a day its month lacks', () => {
    // `Date.parse` takes the last three and moves on: 30 February is 2 March, 24:00 is midnight.
    for (const value of [
      '2026-09-18',
      '2026-13-40T25:61',
      '2026-02-30T10:00',
      '2026-04-31T10:00',
      '2026-09-18T24:00',
    ]) {
      expect(fromDateTimeInput(value, KOLKATA), value).toBeUndefined()
    }
    expect(fromDateTimeInput('2028-02-29T10:00', KOLKATA)).toBe(Date.parse('2028-02-29T04:30:00Z'))
  })
})

describe('dayOfMonth', () => {
  it("reads the day's date, whatever the device's zone", () => {
    expect(dayOfMonth(dayOfLocal(local('2026-10-01T00:00:00')))).toBe(1)
    expect(dayOfMonth(dayOfLocal(local('2028-02-29T23:59:00')))).toBe(29)
  })
})
