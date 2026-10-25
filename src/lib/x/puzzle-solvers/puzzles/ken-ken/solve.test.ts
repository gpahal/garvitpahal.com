import { describe, expect, it } from 'vitest'

import { OPERATIONS } from '../../processing/protocol'
import { cageTuples } from './cage-math'
import { createGrid } from './model'
import type { Cage, KenKenPuzzle } from './model'
import { solveKenKen } from './solve'

const OPTIONS = { timeoutMs: 1000 }

/**
 * A puzzle from its cages, each a clue over row-major cell indexes.
 */
function puzzle(n: number, cages: Array<[Cage, Array<number>]>): KenKenPuzzle {
  const grid = createGrid(n)
  grid.cages = cages.map(([cage]) => cage)
  for (const [cageId, [, cells]] of cages.entries()) {
    for (const cell of cells) {
      grid.cageOf[cell] = cageId
    }
  }
  return { grid, unreviewedCages: [], contradictions: [] }
}

// prettier-ignore
const SOLUTION = [
  1, 2, 3, 4,
  3, 4, 1, 2,
  2, 1, 4, 3,
  4, 3, 2, 1,
]

const CAGES: Array<[Cage, Array<number>]> = [
  [{ op: '+', target: 3 }, [0, 1]],
  [{ op: '*', target: 12 }, [2, 3]],
  [{ op: '=', target: 3 }, [4]],
  [{ op: '/', target: 4 }, [5, 9]],
  [{ op: '=', target: 1 }, [6]],
  [{ op: '+', target: 5 }, [7, 11]],
  [{ op: '=', target: 2 }, [8]],
  [{ op: '=', target: 4 }, [10]],
  [{ op: '=', target: 4 }, [12]],
  [{ op: '-', target: 1 }, [13, 14]],
  [{ op: '=', target: 1 }, [15]],
]

describe('solveKenKen', () => {
  it('solves a 4x4 with every operator in it and proves it unique', () => {
    const result = solveKenKen(puzzle(4, CAGES), OPTIONS)
    expect(result.status).toBe('solved')
    if (result.status !== 'solved') {
      return
    }
    expect(result.isUnique).toBe(true)
    expect([...result.solution]).toEqual(SOLUTION)
  })

  it('reports a clue no values satisfy as unsolvable', () => {
    const cages: Array<[Cage, Array<number>]> = [
      [{ op: '+', target: 9 }, [0, 1]],
      ...CAGES.slice(1),
    ]
    expect(solveKenKen(puzzle(4, cages), OPTIONS)).toEqual({ status: 'unsolvable' })
  })

  it('reports a solve the deadline cut short as a timeout, not as unsolvable', () => {
    // One cage over a 6x6, one more than every Latin square of order 6 sums to: a solve given any
    // time would report it as `unsolvable`.
    const cells = Array.from({ length: 36 }, (_, cell) => cell)
    const result = solveKenKen(puzzle(6, [[{ op: '+', target: 127 }, cells]]), { timeoutMs: -1 })
    expect(result).toEqual({ status: 'timeout' })
  })

  it('checks cage clues even when tuple enumeration is capped', () => {
    // Two full rows must sum to 42, but local enumeration reaches its cap before proving that.
    // Pin the other four rows to a cyclic Latin square so the final search stays small.
    const cells = Array.from({ length: 12 }, (_, cell) => cell)
    const clue: Cage = { op: '+', target: 43 }
    const cages: Array<[Cage, Array<number>]> = [[clue, cells]]
    for (let cell = 12; cell < 36; cell++) {
      const value = ((Math.floor(cell / 6) + (cell % 6)) % 6) + 1
      cages.push([{ op: '=', target: value }, [cell]])
    }
    const off = solveKenKen(puzzle(6, cages), OPTIONS)
    expect(off).toEqual({ status: 'unsolvable' })
  })

  it('proves a grid of cages too large to enumerate unsolvable well within the deadline', () => {
    // Eight 4x2 cages tiling an 8x8. Each can reach 44 alone, but two rows hold 72, not 88.
    const cages: Array<[Cage, Array<number>]> = Array.from({ length: 8 }, (_, block) => {
      const top = Math.floor(block / 2) * 16 + (block % 2) * 4
      const cells = [0, 1, 2, 3].flatMap((col) => [top + col, top + 8 + col])
      return [{ op: '+', target: 44 }, cells]
    })
    // Confirms the cages still take the capped path, which a raised cap would quietly skip.
    const [[clue, cells]] = cages as [[Cage, Array<number>]]
    expect(
      cageTuples(8, Uint16Array.from(cells), clue, Number.MAX_SAFE_INTEGER, () => 0),
    ).toBeUndefined()
    // Within the time an assessment gets.
    expect(solveKenKen(puzzle(8, cages), { timeoutMs: OPERATIONS.assess.budgetMs })).toEqual({
      status: 'unsolvable',
    })
  })
})
