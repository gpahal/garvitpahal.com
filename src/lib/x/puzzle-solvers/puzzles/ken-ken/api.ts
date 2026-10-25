import * as z from 'zod/mini'

import { CAGE_OPS, KEN_KEN_SIZES } from './model'
import type { KenKenPuzzle, KenKenSize } from './model'

export const KEN_KEN_ID = 'ken-ken'

export type KenKenHints = {
  n?: KenKenSize
  heavyEdges?: Array<{ a: string; b: string }>
  /**
   * `heavyEdges` says nothing about these cells' borders.
   */
  unreadCells?: Array<string>
}

/**
 * Open range: an out-of-range clue is a misread the editor marks, but nothing would mark a
 * fractional one.
 */
const cageSchema = z.object({ op: z.enum(CAGE_OPS), target: z.int() })

function namesCageIn(cages: ReadonlyArray<unknown>): (cageId: number) => boolean {
  return (cageId) => Number.isSafeInteger(cageId) && cageId >= 0 && cageId < cages.length
}

/**
 * Closed to what this build constructs; see "Stale tabs" in docs/puzzle-solvers.md. Every
 * cage has a cell and every flag is a distinct cage, so each count on screen has something on the
 * grid to point at.
 */
export const kenKenPuzzleWireSchema = z
  .object({
    n: z.number().check(z.refine(KEN_KEN_SIZES.has, 'Unsupported grid size')),
    cageOf: z.array(z.number()),
    cages: z.array(cageSchema),
    unreviewedCages: z.array(z.number()),
    contradictions: z.array(z.number()),
  })
  .check(
    z.refine(({ n, cageOf }) => cageOf.length === n * n, 'Expected one cage id per cell'),
    z.refine(
      ({ cageOf, cages }) => cageOf.every(namesCageIn(cages)),
      'A cell names a cage that is not there',
    ),
    z.refine(({ cageOf, cages }) => new Set(cageOf).size === cages.length, 'A cage has no cells'),
    z.refine(
      ({ cages, unreviewedCages, contradictions }) =>
        [unreviewedCages, contradictions].every(
          (flags) => flags.every(namesCageIn(cages)) && new Set(flags).size === flags.length,
        ),
      'A flagged cage is not there or is flagged twice',
    ),
    // The review banner counts `unreviewedCages`, so a contradiction outside it would veto trust
    // with nothing on screen for the user to clear.
    z.refine(
      ({ unreviewedCages, contradictions }) =>
        contradictions.every((cageId) => unreviewedCages.includes(cageId)),
      'A contradiction is not among the flagged cages',
    ),
  )

export type KenKenPuzzleWire = z.infer<typeof kenKenPuzzleWireSchema>

export function puzzleToWire(puzzle: KenKenPuzzle): KenKenPuzzleWire {
  return {
    n: puzzle.grid.n,
    cageOf: [...puzzle.grid.cageOf],
    cages: puzzle.grid.cages,
    unreviewedCages: puzzle.unreviewedCages,
    contradictions: puzzle.contradictions,
  }
}

export function puzzleFromWire(wire: KenKenPuzzleWire): KenKenPuzzle {
  return {
    grid: {
      n: wire.n,
      cageOf: Uint8Array.from(wire.cageOf),
      cages: wire.cages,
    },
    unreviewedCages: wire.unreviewedCages,
    contradictions: wire.contradictions,
  }
}
