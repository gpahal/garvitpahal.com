import { describe, expect, it } from 'vitest'

import {
  arePeriodsInOrder,
  contentDateSchema,
  formatMonthRange,
  formatPeriods,
  periodsOf,
  sortNewestFirst,
} from './dates'

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
    const [dec31, jan1] = ['31/12/2024', '01/01/2025'].map((value) =>
      contentDateSchema.parse(value),
    )
    const entries = [
      { id: 'a', date: jan1! },
      { id: 'd', date: dec31! },
      { id: 'B', date: jan1! },
    ]
    // By code unit, so `B` before `a`: `localeCompare` would put it after `a`, and its order
    // depends on the runtime's ICU data.
    for (const input of [entries, entries.toReversed()]) {
      expect(sortNewestFirst(input, (entry) => entry).map(({ id }) => id)).toEqual(['B', 'a', 'd'])
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
  })

  it('lists a resumed role newest period first and accepts only non-overlapping periods', () => {
    const date = (value: string) => contentDateSchema.parse(value)
    const periods = periodsOf({
      startedOn: date('01/06/2026'),
      earlierPeriods: [{ startedOn: date('01/08/2024'), endedOn: date('30/09/2025') }],
    })
    expect(formatPeriods(periods)).toBe('Jun 2026 – Present, Aug 2024 – Sep 2025')
    expect(arePeriodsInOrder(periods)).toBe(true)

    const closed = { startedOn: date('01/01/2024'), endedOn: date('31/12/2024') }
    // An open earlier period and an overlap.
    for (const bad of [
      [{ startedOn: date('01/01/2025') }, { startedOn: date('01/01/2024') }],
      [{ startedOn: date('01/12/2024') }, closed],
    ]) {
      expect(arePeriodsInOrder(bad)).toBe(false)
    }
  })
})
