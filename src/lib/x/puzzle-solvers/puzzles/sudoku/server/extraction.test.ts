import { describe, expect, it } from 'vitest'

import { sudokuExtractionPrompt } from './extraction'
import { describeHints } from './hints'

describe('sudokuExtractionPrompt', () => {
  it('states the measured hints ahead of its rules', () => {
    const hints = { n: 4, boxWidth: 2, boxHeight: 2 } as const
    expect(sudokuExtractionPrompt(hints)).toContain(`${describeHints(hints)}Rules`)
  })

  it('names every size this build accepts', () => {
    expect(sudokuExtractionPrompt({})).toContain('It is 4, 6, 8, 9, 12 or 16.')
  })
})
