import { expect, test } from 'vitest'

import { assessSolve } from './solve-result'
import type { ReadAssessment, SolveResult } from './types'

const SOLUTION = Uint8Array.of(1)

// A dropped fingerprint means agreement between two reads cannot promote the read to trusted.
test.each<[string, SolveResult, string | undefined, ReadAssessment]>([
  ['no solution', { status: 'unsolvable' }, 'f', { confidence: 'misread' }],
  [
    'a unique solve',
    { status: 'solved', solution: SOLUTION, isUnique: true },
    'f',
    { confidence: 'trusted', fingerprint: 'f' },
  ],
  // A solution found before uniqueness checking ran out of time shows the read is solvable.
  [
    'a solve not proven unique',
    { status: 'solved', solution: SOLUTION, isUnique: false },
    'f',
    { confidence: 'suspect', fingerprint: 'f' },
  ],
  // The watchdog gives the same verdict for an assessment that never answers
  // (`OPERATIONS.assess.onTimeout`).
  ['a search that found nothing in time', { status: 'timeout' }, 'f', { confidence: 'suspect' }],
  [
    'a read proven to have several solutions',
    { status: 'multiple', solution: SOLUTION },
    'f',
    { confidence: 'suspect' },
  ],
  [
    'a unique solve without a fingerprint',
    { status: 'solved', solution: SOLUTION, isUnique: true },
    undefined,
    { confidence: 'suspect' },
  ],
])('assesses %s', (_label, outcome, fingerprint, assessment) => {
  expect(assessSolve(outcome, fingerprint)).toEqual(assessment)
})
