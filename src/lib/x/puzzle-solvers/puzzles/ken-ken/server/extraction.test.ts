import { describe, expect, it } from 'vitest'

import type { KenKenHints } from '../api'
import { kenKenExtractionPrompt } from './extraction'
import { describeHints } from './hints'

describe('kenKenExtractionPrompt', () => {
  it('states the measured hints ahead of its rules', () => {
    const hints: KenKenHints = { n: 4, unreadCells: ['D4'] }
    expect(kenKenExtractionPrompt(hints)).toContain(`${describeHints(hints)}Rules`)
  })
})
