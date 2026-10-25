import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'

import { dayOfLocal } from '../shared/intervals'
import { CLOCK_TOO_EARLY_ISSUE } from '../shared/limits'
import { toLocal } from '../shared/localTime'
import { assertQueryDay, assertReading } from './validate'

function refusal(run: () => void): string {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError)
    return (error as ConvexError<string>).data
  }
  throw new Error('Nothing was refused')
}

const AT = Date.UTC(2026, 5, 15, 6, 30)
const KOLKATA_LOCAL = Date.UTC(2026, 5, 15, 12, 0)

function readingRefusal(at: number, atLocal: number, timeZone: string): string {
  return refusal(() => {
    assertReading({ at, atLocal }, timeZone, 'Completion time', 'Too early')
  })
}

describe('assertReading', () => {
  it('takes a real IANA zone, in any casing `Intl` reads', () => {
    for (const name of ['Asia/Kolkata', 'Asia/Calcutta', 'UTC', 'asia/kolkata']) {
      expect(() => {
        assertReading({ at: AT, atLocal: toLocal(AT, name) }, name, 'Completion time', 'Too early')
      }).not.toThrow()
    }
  })

  it('refuses a name longer than any IANA name, quoting only its start', () => {
    // A refused zone is refused before the reading is looked at.
    expect(readingRefusal(AT, KOLKATA_LOCAL, `Mars/${'x'.repeat(100_000)}`)).toBe(
      `"Mars/${'x'.repeat(59)}…" is not a time zone this server knows. In this device's date and time settings, choose a named time zone, or a nearby city's if this one is new, then try again`,
    )
  })

  it('refuses a reading that does not match its instant, or an instant that is not a time', () => {
    expect(readingRefusal(AT, KOLKATA_LOCAL + 60_000, 'Asia/Kolkata')).toBe(
      "This device's time zone data for Asia/Kolkata does not match the server's. Update this browser or operating system so its time zone data is current, then try again. If it is already current, the server's data may be older: until it catches up, set this device to a zone that shows the same time",
    )
    // The instant is checked first, so a NaN is reported as not a time.
    expect(readingRefusal(NaN, KOLKATA_LOCAL, 'Asia/Kolkata')).toBe('Completion time is not a time')
  })

  it('refuses a reading before 2025, and an instant too early to read whatever reading it has', () => {
    const early = Date.UTC(2024, 11, 31, 20)
    expect(readingRefusal(early, early, 'UTC')).toBe('Too early')
    // `toLocal` reads this BC instant as year 200001, so only the instant's own floor refuses it.
    const bc = Date.parse('-200000-01-01T00:00:00Z')
    expect(readingRefusal(bc, toLocal(bc, 'UTC'), 'UTC')).toBe('Too early')
  })
})

describe('assertQueryDay', () => {
  it('takes a day before 2024 as a wrong device clock', () => {
    const first = dayOfLocal(Date.UTC(2024, 0, 1))
    expect(() => {
      assertQueryDay(first)
    }).not.toThrow()
    expect(
      refusal(() => {
        assertQueryDay(first - 1)
      }),
    ).toBe(CLOCK_TOO_EARLY_ISSUE)
    expect(
      refusal(() => {
        assertQueryDay(first + 0.5)
      }),
    ).toMatch(/^Day must be a whole number/)
  })
})
