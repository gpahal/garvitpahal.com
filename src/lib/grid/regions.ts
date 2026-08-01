import { orthogonalNeighbours } from './geometry'

/** Neighbours of `cell` still waiting to be claimed, minus any adjacency `isJoined` vetoes. */
function reachableFrom(
  n: number,
  cell: number,
  remaining: Set<number>,
  isJoined: ((a: number, b: number) => boolean) | undefined,
): Array<number> {
  const reachable: Array<number> = []
  for (const neighbour of orthogonalNeighbours(n, cell)) {
    if (!remaining.has(neighbour) || (isJoined && !isJoined(cell, neighbour))) {
      continue
    }
    reachable.push(neighbour)
  }
  return reachable
}

/**
 * Splits `cells` into groups that are reachable from each other by orthogonal steps within the set.
 *
 * `isJoined` can veto an individual adjacency, which is what lets a caller ask "what would this
 * region look like if these two neighbours were not connected" without building a second cell set.
 */
export function connectedComponents(
  n: number,
  cells: Iterable<number>,
  isJoined?: (a: number, b: number) => boolean,
): Array<Array<number>> {
  const remaining = new Set(cells)
  const components: Array<Array<number>> = []

  while (remaining.size > 0) {
    const [start] = remaining
    const component: Array<number> = []
    const queue = [start!]
    remaining.delete(start!)

    while (queue.length > 0) {
      const cell = queue.pop()!
      component.push(cell)
      for (const neighbour of reachableFrom(n, cell, remaining, isJoined)) {
        remaining.delete(neighbour)
        queue.push(neighbour)
      }
    }

    component.sort((a, b) => a - b)
    components.push(component)
  }

  return components
}

export type CompactedLabels = {
  /** Same length as the input, renumbered to `0 .. order.length - 1`. */
  labels: Uint8Array
  /** `order[newLabel]` is the label it replaced, so parallel arrays can be reordered to match. */
  order: Array<number>
}

/**
 * Renumbers labels to a gapless range, in order of first appearance. Used after any edit that can
 * empty a region, so ids stay usable as indices into a parallel array.
 */
export function compactLabels(labels: Uint8Array): CompactedLabels {
  const toNew = new Map<number, number>()
  const order: Array<number> = []
  const next = new Uint8Array(labels.length)

  for (const [index, label] of labels.entries()) {
    let mapped = toNew.get(label)
    if (mapped === undefined) {
      mapped = order.length
      toNew.set(label, mapped)
      order.push(label)
    }
    next[index] = mapped
  }

  return { labels: next, order }
}
