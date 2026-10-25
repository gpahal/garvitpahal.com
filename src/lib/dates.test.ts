import { describe, expect, it } from 'vitest'

import { contentDateSchema, dateOnlyToUtc, formatMonthRange, sortNewestFirst } from './dates'

describe('content calendar dates', () => {
  it('strictly validates leap days and author format', () => {
    expect(contentDateSchema.parse('29/02/2024')).toBe('2024-02-29')
    for (const bad of [
      '29/02/2023',
      '31/04/2024',
      '00/01/2024',
      '01/13/2024',
      '1/01/2024',
      '2024-01-01',
    ]) {
      expect(contentDateSchema.safeParse(bad).success).toBe(false)
    }
  })

  it('sorts newest first and breaks a same-day tie by id, whatever the input order', () => {
    const [dec31, jan1, feb1] = ['31/12/2024', '01/01/2025', '01/02/2025'].map((value) =>
      contentDateSchema.parse(value),
    )
    const entries = [
      { id: 'b', date: jan1! },
      { id: 'd', date: dec31! },
      { id: 'c', date: feb1! },
      { id: 'a', date: jan1! },
      { id: 'B', date: jan1! },
    ]
    // By code unit, so `B` before `a`: `localeCompare` would put it after `b`, and its order
    // depends on the runtime's ICU data.
    for (const input of [entries, entries.toReversed()]) {
      expect(sortNewestFirst(input, (entry) => entry).map(({ id }) => id)).toEqual([
        'c',
        'B',
        'a',
        'b',
        'd',
      ])
    }
  })

  it('formats a month range from the date strings alone', () => {
    // Midnight UTC on the 1st is in the month before west of UTC; the string is not.
    expect(
      formatMonthRange(
        contentDateSchema.parse('01/01/2025'),
        contentDateSchema.parse('31/12/2025'),
      ),
    ).toBe('Jan 2025 – Dec 2025')
    expect(formatMonthRange(contentDateSchema.parse('01/01/2025'), undefined)).toBe(
      'Jan 2025 – Present',
    )
    // The feed's timestamps: midnight UTC, whatever zone the build runs in.
    expect(dateOnlyToUtc(contentDateSchema.parse('01/01/2025')).toISOString()).toBe(
      '2025-01-01T00:00:00.000Z',
    )
  })
})
