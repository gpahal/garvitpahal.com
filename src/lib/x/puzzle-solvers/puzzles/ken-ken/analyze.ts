import { enhance } from '../../capture/enhance'
import { toGray } from '../../capture/pixels'
import type { PixelImage } from '../../capture/pixels'
import { cellName } from '../../grid/geometry'
import { edgeMasses, readLattice, shadedCells, splitHeavy } from '../../grid/lines'
import type { GridEdge } from '../../grid/lines'
import type { KenKenHints } from './api'
import { KEN_KEN_SIZES } from './model'

/**
 * Cage borders measure several times heavier than cell lines. A muddier picture gets no edge hints
 * rather than a partial set.
 */
const HEAVY_EDGE_MIN_SEPARATION = 0.3

function farCell(n: number, edge: GridEdge): number {
  return edge.side === 'right' ? edge.cell + 1 : edge.cell + n
}

/**
 * Lines are measured on the enhanced crop, where their weights separate. Shaded cells are found on
 * `crop` as given, since enhancement flattens a fill wider than its background window.
 */
export function analyzeKenKen(crop: PixelImage): KenKenHints {
  const { contrast, lattice } = readLattice(toGray(enhance(crop)), KEN_KEN_SIZES.list)
  if (!lattice) {
    return {}
  }

  const { n } = lattice
  const hints: KenKenHints = { n }
  // A highlighted cell changes the weight of every line beside it, so those edges are left out of
  // the split.
  const shaded = new Set(shadedCells(toGray(crop), lattice))
  const edges = edgeMasses(contrast, lattice).filter(
    (edge) => !shaded.has(edge.cell) && !shaded.has(farCell(n, edge)),
  )
  const split = splitHeavy(
    edges.map((edge) => edge.mass),
    HEAVY_EDGE_MIN_SEPARATION,
  )
  if (split) {
    hints.heavyEdges = edges
      .filter((edge) => split.isHeavy(edge.mass))
      .map((edge) => ({ a: cellName(n, edge.cell), b: cellName(n, farCell(n, edge)) }))
    if (shaded.size > 0) {
      hints.unreadCells = [...shaded].toSorted((a, b) => a - b).map((cell) => cellName(n, cell))
    }
  }
  return hints
}
