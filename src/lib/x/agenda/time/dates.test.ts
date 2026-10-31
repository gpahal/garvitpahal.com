import { describe, expect, it } from 'vitest'

import { fromDateTimeInput } from './dates'
import { KOLKATA } from './test-readings'

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
