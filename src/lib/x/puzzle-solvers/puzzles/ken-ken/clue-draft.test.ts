import { describe, expect, it } from 'vitest'

import { parseTarget } from './clue-draft'

describe('parseTarget', () => {
  it('takes a positive whole number and nothing else', () => {
    expect(parseTarget('12')).toBe(12)
    expect(parseTarget('')).toBe(0)
    expect(parseTarget('0')).toBe(0)
    expect(parseTarget('-5')).toBe(0)
    // Past the safe range there is no number left to mean, so it is no clue either.
    expect(parseTarget('99999999999999999999')).toBe(0)
  })
})
