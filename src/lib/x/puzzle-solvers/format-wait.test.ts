import { describe, expect, it } from 'vitest'

import { formatWait } from './format-wait'

describe('formatWait', () => {
  it('never rounds a wait down, and never says to go now', () => {
    expect(formatWait(0)).toBe('1s')
    expect(formatWait(12_300)).toBe('13s')
    expect(formatWait(59_000)).toBe('59s')
    expect(formatWait(59_001)).toBe('1 min')
    expect(formatWait(864_000)).toBe('15 mins')
    expect(formatWait(3_600_000)).toBe('1 hr')
    expect(formatWait(3_600_001)).toBe('1 hr 1 min')
    expect(formatWait(7_200_000)).toBe('2 hrs')
  })
})
