import { expect, test } from 'vitest'

import { reachableDays } from './day'
import { dayOfIsoDate } from './time/dates'

test('reaches from 1 January 2025 to the end of the tenth year on', () => {
  const day = (iso: string) => dayOfIsoDate(iso) ?? NaN
  // 1 January is still the old year to a local getter west of UTC.
  for (const today of ['2026-01-01', '2026-12-31']) {
    expect(reachableDays(day(today)), today).toEqual({
      first: day('2025-01-01'),
      last: day('2036-12-31'),
    })
  }
})
