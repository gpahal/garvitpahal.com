import { describe, expect, it } from 'vitest'

import { kenKenPuzzleWireSchema, puzzleToWire } from './api'
import { createPuzzle } from './model'

const wire = puzzleToWire(createPuzzle(6))
const withFirstCage = (cage: object) => ({ ...wire, cages: [cage, ...wire.cages.slice(1)] })

// What this build sends passes, and what it could not have sent is refused (docs/puzzle-solvers.md,
// "Stale tabs").
describe('the Ken Ken wire schema', () => {
  it.each([
    ['what this build sends', wire, true],
    ['a clue out of range', withFirstCage({ op: '+', target: -5 }), true],
    [
      'a size with no grid',
      {
        n: 9,
        cageOf: Array.from({ length: 81 }, (_, cell) => cell),
        cages: Array.from({ length: 81 }, () => ({ op: '=', target: 0 })),
        unreviewedCages: [],
        contradictions: [],
      },
      false,
    ],
    ['too few cells', { ...wire, cageOf: wire.cageOf.slice(1) }, false],
    ['a cell naming a missing cage', { ...wire, cages: wire.cages.slice(0, -1) }, false],
    ['a clue that is not a whole number', withFirstCage({ op: '+', target: 2.5 }), false],
    [
      'a cage no cell belongs to',
      { ...wire, cages: [...wire.cages, { op: '+', target: 3 }] },
      false,
    ],
    ['a cage flagged twice', { ...wire, unreviewedCages: [0, 0] }, false],
    ['a flag naming a missing cage', { ...wire, unreviewedCages: [wire.cages.length] }, false],
    [
      'a contradiction not flagged for review',
      { ...wire, unreviewedCages: [1], contradictions: [0] },
      false,
    ],
  ])('judges %s', (_label, candidate, isAccepted) => {
    expect(kenKenPuzzleWireSchema.safeParse(candidate).success).toBe(isAccepted)
  })
})
