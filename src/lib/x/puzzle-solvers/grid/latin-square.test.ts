import { describe, expect, it } from 'vitest'

import { NEVER, STOPPED } from '../csp/test-deadline'
import { openDomains, solveLatinSquare } from './latin-square'

/**
 * The one Latin square of order 3 whose first row and column both read 1, 2, 3.
 */
const REDUCED = [1, 2, 3, 2, 3, 1, 3, 1, 2]

describe('solveLatinSquare', () => {
  it('keeps only the complete assignments the final check accepts', () => {
    const result = solveLatinSquare(3, openDomains(3), {
      deadline: NEVER,
      now: STOPPED,
      isSolution: (values) => values.join('') === REDUCED.join(''),
    })
    expect(result).toMatchObject({ status: 'solved', isUnique: true })
  })

  it('keeps a solution found before uniqueness checking ran out of time, without proving it unique', () => {
    let now = 0
    const result = solveLatinSquare(3, openDomains(3), {
      deadline: 10,
      now: () => now,
      isSolution: () => {
        now = 10
        return true
      },
    })
    expect(result).toMatchObject({ status: 'solved', isUnique: false })
  })

  it.each([true, false])(
    'keeps a completed proof when the final validation crosses the deadline: %s',
    (isSolution) => {
      let now = 0
      const result = solveLatinSquare(1, openDomains(1), {
        deadline: 10,
        now: () => now,
        isSolution: () => {
          now = 10
          return isSolution
        },
      })
      expect(result.status).toBe(isSolution ? 'solved' : 'unsolvable')
    },
  )

  it('checks an expired deadline before any propagation', () => {
    const result = solveLatinSquare(1, openDomains(1), {
      deadline: 10,
      now: () => 10,
      propagators: [
        () => {
          throw new Error('must not propagate')
        },
      ],
    })
    expect(result).toEqual({ status: 'timeout' })
  })
})
