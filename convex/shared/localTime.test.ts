import { describe, expect, it } from 'vitest'

import { dayOfLocal } from './intervals'
import { SECOND_MS } from './limits'
import {
  dayOfInstant,
  fromLocal,
  instantRangeOfDay,
  isNamedTimeZone,
  offsetAt,
  toLocal,
} from './localTime'

const HOUR_MS = 3_600_000

const KOLKATA = 'Asia/Kolkata'
const NEW_YORK = 'America/New_York'
const LORD_HOWE = 'Australia/Lord_Howe'
const SANTIAGO = 'America/Santiago'

/**
 * A wall-clock reading, written as if UTC.
 */
function local(iso: string): number {
  return Date.parse(`${iso}Z`)
}

describe('toLocal', () => {
  it('reads a UTC instant as the wall clock of the zone, written as if UTC', () => {
    expect(toLocal(Date.parse('2026-09-18T10:00:00Z'), KOLKATA)).toBe(
      Date.parse('2026-09-18T15:30:00Z'),
    )
    expect(toLocal(Date.parse('2026-01-15T03:00:00Z'), NEW_YORK)).toBe(
      Date.parse('2026-01-14T22:00:00Z'),
    )
  })
})

describe('offsetAt', () => {
  it('follows a clock change, which is the whole reason it takes an instant', () => {
    // US spring forward 2026: 02:00 EST becomes 03:00 EDT.
    expect(offsetAt(Date.parse('2026-03-08T06:59:59Z'), NEW_YORK)).toBe(-5 * HOUR_MS)
    expect(offsetAt(Date.parse('2026-03-08T07:00:00Z'), NEW_YORK)).toBe(-4 * HOUR_MS)
  })

  it('is read off the second, so milliseconds never move it', () => {
    const second = Date.parse('2026-09-18T10:00:42Z')
    expect(offsetAt(second + 999, KOLKATA)).toBe(offsetAt(second, KOLKATA))
    expect(offsetAt(second, KOLKATA) % SECOND_MS).toBe(0)
  })
})

describe('isNamedTimeZone', () => {
  it('takes a zone by name, the only kind stored, a fixed one included', () => {
    expect(isNamedTimeZone(KOLKATA)).toBe(true)
    // A zone renamed long ago still resolves, and a stored one may well be spelled this way.
    expect(isNamedTimeZone('Asia/Calcutta')).toBe(true)
    // A fixed zone is not what it refuses: an IANA name for one is stored like any other.
    expect(isNamedTimeZone('Etc/GMT+5')).toBe(true)
  })

  it('refuses a fixed offset and a name no tzdata has', () => {
    expect(isNamedTimeZone('+05:30')).toBe(false)
    // A Unicode minus, which `Intl` reads as `-05:30`.
    expect(isNamedTimeZone('\u{2212}05:30')).toBe(false)
    expect(isNamedTimeZone('Not/AZone')).toBe(false)
    expect(isNamedTimeZone('')).toBe(false)
  })
})

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
    expect(toLocal(transition, NEW_YORK)).toBe(local('2026-03-08T03:00:00'))
  })

  it('resolves a time in a clocks-back repeat to the first occurrence', () => {
    // 1 Nov 2026: 02:00 EDT falls back to 01:00 EST at 06:00Z, so 01:30 happens twice.
    expect(fromLocal(local('2026-11-01T01:30:00'), NEW_YORK)).toBe(
      Date.parse('2026-11-01T05:30:00Z'),
    )
    // 02:00 only happens once, after the repeat.
    expect(fromLocal(local('2026-11-01T02:00:00'), NEW_YORK)).toBe(
      Date.parse('2026-11-01T07:00:00Z'),
    )
  })
})

describe('day ranges', () => {
  it('makes a clocks-back day 25 real hours long', () => {
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
