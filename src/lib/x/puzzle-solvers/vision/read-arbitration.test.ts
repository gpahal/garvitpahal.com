import { describe, expect, it } from 'vitest'

import type { ReadConfidence } from '../puzzles/types'
import { considerRead, createArbitration } from './read-arbitration'
import type { Candidate } from './read-arbitration'

function read(
  puzzle: string,
  rank: number,
  confidence: ReadConfidence,
  fingerprint: string | undefined = puzzle,
): Candidate<string> {
  return { puzzle, rank, confidence, fingerprint }
}

describe('considerRead', () => {
  it('keeps the first suspect and only replaces it with a higher rank', () => {
    const arbitration = createArbitration<string>()
    expect(considerRead(arbitration, read('a', 1, 'suspect')).isSettled).toBe(false)
    expect(arbitration.best?.puzzle).toBe('a')
    considerRead(arbitration, read('b', 0, 'suspect'))
    expect(arbitration.best?.puzzle).toBe('a')
    expect(considerRead(arbitration, read('c', 2, 'suspect')).isSettled).toBe(false)
    expect(arbitration.best?.puzzle).toBe('c')
  })

  it('trusts two calls that agree, and never one agreeing with itself', () => {
    const arbitration = createArbitration<string>()
    considerRead(arbitration, read('a', 1, 'suspect', 'same'))
    expect(considerRead(arbitration, read('b', 1, 'suspect', 'same')).isSettled).toBe(false)
    expect(considerRead(arbitration, read('c', 0, 'suspect', 'same')).isSettled).toBe(true)
    expect(arbitration.best).toMatchObject({ puzzle: 'a', confidence: 'trusted' })
  })

  it('settles on the higher-ranked of two that agree, over a higher-ranked suspect alone', () => {
    const arbitration = createArbitration<string>()
    considerRead(arbitration, read('lone', 2, 'suspect', 'x'))
    considerRead(arbitration, read('a', 0, 'suspect', 'same'))
    expect(arbitration.best?.puzzle).toBe('lone')
    expect(considerRead(arbitration, read('b', 1, 'suspect', 'same')).isSettled).toBe(true)
    expect(arbitration.best).toMatchObject({ puzzle: 'b', rank: 1, confidence: 'trusted' })
  })

  it('never agrees on a read without a fingerprint', () => {
    const arbitration = createArbitration<string>()
    const first = { ...read('a', 0, 'suspect'), fingerprint: undefined }
    const second = { ...read('b', 1, 'suspect'), fingerprint: undefined }
    expect(considerRead(arbitration, first).isSettled).toBe(false)
    expect(considerRead(arbitration, second).isSettled).toBe(false)
    expect(arbitration.best).toMatchObject({ puzzle: 'b', confidence: 'suspect' })
  })

  it('keeps the best misread as a last resort, apart from the best read', () => {
    const arbitration = createArbitration<string>()
    expect(considerRead(arbitration, read('a', 0, 'misread')).isSettled).toBe(false)
    considerRead(arbitration, read('b', 1, 'misread'))
    expect(arbitration.best).toBeUndefined()
    expect(arbitration.lastResort?.puzzle).toBe('b')
    considerRead(arbitration, read('s', 0, 'suspect'))
    expect(considerRead(arbitration, read('wrong', 5, 'misread')).isSettled).toBe(false)
    expect(arbitration.best?.puzzle).toBe('s')
    expect(arbitration.lastResort?.puzzle).toBe('wrong')
  })
})
