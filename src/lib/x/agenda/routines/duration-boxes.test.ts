import { describe, expect, it } from 'vitest'

import { comparableDuration, parseDuration } from './duration-boxes'
import type { DurationBoxes } from './duration-boxes'

function boxes(days: string, hours: string, minutes: string): DurationBoxes {
  return { days, hours, minutes }
}

describe('comparableDuration', () => {
  it('compares totals, so the same duration typed another way is no edit', () => {
    expect(comparableDuration('weekly', boxes('0', '24', '0'), 'none')).toBe(
      comparableDuration('weekly', boxes('1', '', ''), 'none'),
    )
    // Not a whole number: an edit, whatever it would come to.
    expect(comparableDuration('daily', boxes('', '0.5', '0'), 'none')).not.toBe(
      comparableDuration('daily', boxes('', '0', '30'), 'none'),
    )
  })

  it('keeps a days-only edit an edit under the kind the boxes were opened with', () => {
    // A log form opened on a weekly goal keeps comparing as weekly after the goal becomes daily.
    const opened = boxes('0', '0', '30')
    const edited = boxes('1', '0', '30')
    expect(comparableDuration('weekly', edited, 'zero')).not.toBe(
      comparableDuration('weekly', opened, 'zero'),
    )
    expect(comparableDuration('daily', edited, 'zero')).toBe(
      comparableDuration('daily', opened, 'zero'),
    )
  })
})

describe('parseDuration', () => {
  it('refuses a box with a unit or exponent typed in, rather than reading a number from it', () => {
    for (const typed of ['1h', '1e']) {
      const parsed = parseDuration('daily', boxes('', typed, '30'))
      expect(parsed.minutes, typed).toBeUndefined()
      expect(parsed.errors.hours, typed).toBeDefined()
    }
  })
})
