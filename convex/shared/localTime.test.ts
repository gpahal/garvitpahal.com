import { describe, expect, it } from 'vitest'

import { SECOND_MS } from './limits'
import { isNamedTimeZone, offsetAt, toLocal } from './localTime'

const HOUR_MS = 3_600_000

const KOLKATA = 'Asia/Kolkata'
const NEW_YORK = 'America/New_York'

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
    // Should `Intl` ever refuse an offset, the check has become dead code.
    expect(() => new Intl.DateTimeFormat('en-US', { timeZone: '+05:30' })).not.toThrow()
    expect(isNamedTimeZone('+05:30')).toBe(false)
    // A Unicode minus, which `Intl` reads as `-05:30`.
    expect(isNamedTimeZone('\u{2212}05:30')).toBe(false)
    expect(isNamedTimeZone('Not/AZone')).toBe(false)
    expect(isNamedTimeZone('')).toBe(false)
  })
})
