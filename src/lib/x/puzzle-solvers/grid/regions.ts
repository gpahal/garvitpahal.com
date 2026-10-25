import { orthogonalNeighbours } from './geometry'

/**
 * Orthogonally connected groups of `cells`. `isJoined` can veto one adjacency, to ask what a region
 * would be without it.
 */
export function connectedComponents(
  n: number,
  cells: Iterable<number>,
  isJoined?: (a: number, b: number) => boolean,
): Array<Array<number>> {
  const remaining = new Set(cells)
  const components: Array<Array<number>> = []

  for (let [start] = remaining; start !== undefined; [start] = remaining) {
    const component: Array<number> = []
    const queue = [start]
    remaining.delete(start)

    for (let cell = queue.pop(); cell !== undefined; cell = queue.pop()) {
      component.push(cell)
      for (const neighbour of orthogonalNeighbours(n, cell)) {
        if (!remaining.has(neighbour) || (isJoined && !isJoined(cell, neighbour))) {
          continue
        }
        remaining.delete(neighbour)
        queue.push(neighbour)
      }
    }

    components.push(component.toSorted((a, b) => a - b))
  }

  return components
}

type CompactedLabels = {
  labels: Uint8Array
  /**
   * `order[newLabel]` is the label it replaced.
   */
  order: Array<number>
}

/**
 * Renumbers in order of first appearance, so ids stay usable as indices into a parallel array.
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

/**
 * A label up to `count` that no cell carries is an empty group rather than a missing one.
 */
export function cellsByLabel(labels: Uint8Array, count: number): Array<Array<number>> {
  const groups: Array<Array<number>> = Array.from({ length: count }, () => [])
  for (const [cell, label] of labels.entries()) {
    while (groups.length <= label) {
      groups.push([])
    }
    groups[label]?.push(cell)
  }
  return groups
}
