import { guessPolarity, strokeContrast, type GrayImage } from '@/lib/capture/pixels'
import { cellName } from '@/lib/grid/geometry'
import {
  detectLattice,
  edgeMasses,
  shadedCells,
  splitHeavy,
  type GridEdge,
  type Lattice,
} from '@/lib/grid/lines'

import type { KenKenHints } from './hints'
import { KEN_KEN_SIZES, type KenKenSize } from './model'

/**
Wider than the heaviest stroke at 1024px, so a line stands out from its own surroundings.
*/
const CONTRAST_RADIUS = 20

/**
 * Cage borders are drawn several times heavier than cell lines, and the bench's truth script found
 * the two perfectly separable. A muddier picture gets no edge hints rather than a partial set.
 */
const HEAVY_EDGE_MIN_SEPARATION = 0.3

export type KenKenAnalysis = {
  lattice: Lattice<KenKenSize> | undefined
  /**
  The heavy edges as measured, before they are named for the hint.
  */
  heavyEdges: Array<GridEdge>
  hints: KenKenHints
}

/**
 * The size and the heavy-edge map of a rectified Ken Ken. The cages follow from the edges by
 * union-find, which the prompt builder does; the hint carries the edges because that is what was
 * measured.
 */
export function analyzeKenKen(gray: GrayImage): KenKenAnalysis {
  const contrast = strokeContrast(gray, CONTRAST_RADIUS, guessPolarity(gray))
  const lattice = detectLattice(contrast, KEN_KEN_SIZES)
  if (!lattice) {
    return { lattice: undefined, heavyEdges: [], hints: {} }
  }

  const { n } = lattice
  const hints: KenKenHints = { n }
  // A highlighted cell changes the weight of every line beside it, so those edges are neither
  // classified nor allowed to skew the split between the rest.
  const shaded = new Set(shadedCells(gray, lattice))
  const edges = edgeMasses(contrast, lattice).filter(
    (edge) =>
      !shaded.has(edge.cell) && !shaded.has(edge.side === 'right' ? edge.cell + 1 : edge.cell + n),
  )
  const split = splitHeavy(
    edges.map((edge) => edge.mass),
    HEAVY_EDGE_MIN_SEPARATION,
  )
  const heavyEdges: Array<GridEdge> = []
  if (split) {
    for (const edge of edges) {
      if (split.isHeavy(edge.mass)) {
        heavyEdges.push({ cell: edge.cell, side: edge.side })
      }
    }
    hints.heavyEdges = heavyEdges.map((edge) => ({
      a: cellName(n, edge.cell),
      b: cellName(n, edge.side === 'right' ? edge.cell + 1 : edge.cell + n),
    }))
    if (shaded.size > 0) {
      hints.unreadCells = [...shaded].sort((a, b) => a - b).map((cell) => cellName(n, cell))
    }
  }
  return { lattice, heavyEdges, hints }
}
