import { colOf, rowOf } from '@/lib/grid/geometry'

import type { Cage, CageOp } from './model'

/**
 * Ceilings on enumeration. A real cage is a handful of cells and finishes far inside both, but the
 * editor lets a user merge the whole grid into one cage, and that must not hang the browser.
 */
const MAX_CAGE_TUPLES = 20_000
const MAX_CAGE_NODES = 200_000

/** How often to consult the clock, matching the search. Checking every node is measurably slower. */
const DEADLINE_CHECK_INTERVAL = 2048

/**
 * Subtraction and division are only ever printed on a two-cell cage, and a bare number is always a
 * single cell. Anything else is a mis-traced border, not an exotic variant.
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
    default: {
      return cellCount >= 1
    }
  }
}

/** A cage's values, however the caller happens to be holding them. */
type CageValues = Iterable<number> & { readonly length: number }

/** Whether a complete assignment satisfies the clue. Order-independent, as the puzzle requires. */
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
      return Math.abs(first! - second!) === cage.target
    }
    case '/': {
      const high = Math.max(first!, second!)
      const low = Math.min(first!, second!)
      return high % low === 0 && high / low === cage.target
    }
    default: {
      return first === cage.target
    }
  }
}

/**
 * For each position, the earlier positions it shares a row or column with. Those must differ; every
 * other pair in the cage may repeat, which is the rule that stops a cage being just another
 * all-different group.
 */
function buildConflicts(n: number, cells: Uint16Array): Array<Array<number>> {
  return Array.from({ length: cells.length }, (_, position) => {
    const cell = cells[position]!
    const conflicts: Array<number> = []
    for (let earlier = 0; earlier < position; earlier++) {
      const other = cells[earlier]!
      if (rowOf(n, cell) === rowOf(n, other) || colOf(n, cell) === colOf(n, other)) {
        conflicts.push(earlier)
      }
    }
    return conflicts
  })
}

/** Can `sum` still reach the target with `remaining` cells of 1..n left to place? */
function canReachSum(sum: number, remaining: number, n: number, target: number): boolean {
  return sum + remaining <= target && sum + remaining * n >= target
}

/** A product can only grow, and every factor is an integer, so it must divide the target. */
function canReachProduct(product: number, target: number): boolean {
  return product <= target && target % product === 0
}

/**
 * Every assignment of 1..n to `cells` that satisfies the clue, aligned with `cells`.
 *
 * `undefined` means the search was cut short and the result is incomplete, so the caller must not
 * treat it as the full set - the solver drops the cage from propagation and falls back to checking
 * it on complete assignments instead.
 *
 * `deadline` is the same clock the solver's own search runs against, so enumerating a pathological
 * cage cannot spend time on top of the caller's budget rather than out of it.
 */
export function cageTuples(
  n: number,
  cells: Uint16Array,
  cage: Cage,
  deadline: number,
): Array<Uint8Array> | undefined {
  if (!isCageArityValid(cage.op, cells.length)) {
    return []
  }

  const conflicts = buildConflicts(n, cells)
  const tuples: Array<Uint8Array> = []
  const current = new Uint8Array(cells.length)
  let nodes = 0
  let isCapped = false

  function isAllowed(position: number, value: number, sum: number, product: number): boolean {
    const sharesLine = conflicts[position]!
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
      default: {
        return true
      }
    }
  }

  function place(position: number, sum: number, product: number): void {
    if (isCapped) {
      return
    }
    nodes++
    if (nodes > MAX_CAGE_NODES) {
      isCapped = true
      return
    }
    if (nodes % DEADLINE_CHECK_INTERVAL === 0 && Date.now() > deadline) {
      isCapped = true
      return
    }

    if (position === cells.length) {
      if (isClueSatisfied(current, cage)) {
        tuples.push(Uint8Array.from(current))
        if (tuples.length > MAX_CAGE_TUPLES) {
          isCapped = true
        }
      }
      return
    }

    for (let value = 1; value <= n; value++) {
      if (!isAllowed(position, value, sum, product)) {
        continue
      }
      current[position] = value
      place(position + 1, sum + value, product * value)
      if (isCapped) {
        return
      }
    }
  }

  place(0, 0, 1)
  return isCapped ? undefined : tuples
}
