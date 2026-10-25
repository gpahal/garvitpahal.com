import { colOf, rowOf } from '../../grid/geometry'
import type { Cage, CageOp } from './model'

/**
 * A real cage finishes far inside both, but the editor lets a user merge the whole grid into one
 * cage, which must not hang the browser.
 */
const MAX_CAGE_TUPLES = 20_000
const MAX_CAGE_NODES = 200_000

/**
 * Anything else is a mis-traced border, not an exotic variant.
 */
export function isCageArityValid(op: CageOp, cellCount: number): boolean {
  switch (op) {
    case '=': {
      return cellCount === 1
    }
    case '-':
    case '/': {
      return cellCount === 2
    }
    case '+':
    case '*': {
      return cellCount >= 1
    }
  }
}

type CageValues = Iterable<number> & { readonly length: number }

export function isClueSatisfied(values: CageValues, cage: Cage): boolean {
  if (!isCageArityValid(cage.op, values.length)) {
    return false
  }

  const [first, second] = values

  switch (cage.op) {
    case '+': {
      let sum = 0
      for (const value of values) {
        sum += value
      }
      return sum === cage.target
    }
    case '*': {
      let product = 1
      for (const value of values) {
        product *= value
      }
      return product === cage.target
    }
    case '-': {
      return first !== undefined && second !== undefined && Math.abs(first - second) === cage.target
    }
    case '/': {
      if (first === undefined || second === undefined) {
        return false
      }
      const high = Math.max(first, second)
      const low = Math.min(first, second)
      return high % low === 0 && high / low === cage.target
    }
    case '=': {
      return first === cage.target
    }
  }
}

/**
 * The earlier positions each shares a line with, which must differ; any other pair in a cage may
 * repeat.
 */
function buildConflicts(n: number, cells: Uint16Array): Array<Array<number>> {
  return Array.from({ length: cells.length }, (_, position) => {
    const cell = cells[position] ?? 0
    const conflicts: Array<number> = []
    for (let earlier = 0; earlier < position; earlier++) {
      const other = cells[earlier] ?? 0
      if (rowOf(n, cell) === rowOf(n, other) || colOf(n, cell) === colOf(n, other)) {
        conflicts.push(earlier)
      }
    }
    return conflicts
  })
}

function canReachSum(sum: number, remaining: number, n: number, target: number): boolean {
  return sum + remaining <= target && sum + remaining * n >= target
}

function canReachProduct(product: number, target: number): boolean {
  return product <= target && target % product === 0
}

/**
 * `undefined` means the search was cut short, so the caller bounds the cage instead. `deadline` is
 * the solver's own, so a pathological cage spends its budget; it is read only before and after, and
 * the node ceiling bounds how far one cage can run past it.
 */
export function cageTuples(
  n: number,
  cells: Uint16Array,
  cage: Cage,
  deadline: number,
  now: () => number,
): Array<Uint8Array> | undefined {
  if (now() >= deadline) return undefined
  if (!isCageArityValid(cage.op, cells.length)) {
    return []
  }

  const conflicts = buildConflicts(n, cells)
  const tuples: Array<Uint8Array> = []
  const current = new Uint8Array(cells.length)
  let nodes = 0

  function isAllowed(position: number, value: number, sum: number, product: number): boolean {
    const sharesLine = conflicts[position] ?? []
    for (const earlier of sharesLine) {
      if (current[earlier] === value) {
        return false
      }
    }
    const remaining = cells.length - position - 1
    switch (cage.op) {
      case '+': {
        return canReachSum(sum + value, remaining, n, cage.target)
      }
      case '*': {
        return canReachProduct(product * value, cage.target)
      }
      case '-':
      case '/':
      case '=': {
        return true
      }
    }
  }

  /**
   * Whether a cap was hit, which ends the whole search.
   */
  function place(position: number, sum: number, product: number): boolean {
    nodes++
    if (nodes > MAX_CAGE_NODES) {
      return true
    }

    if (position === cells.length) {
      if (isClueSatisfied(current, cage)) {
        tuples.push(Uint8Array.from(current))
        return tuples.length > MAX_CAGE_TUPLES
      }
      return false
    }

    for (let value = 1; value <= n; value++) {
      if (!isAllowed(position, value, sum, product)) {
        continue
      }
      current[position] = value
      if (place(position + 1, sum + value, product * value)) {
        return true
      }
    }
    return false
  }

  const isCapped = place(0, 0, 1)
  return isCapped || now() >= deadline ? undefined : tuples
}
