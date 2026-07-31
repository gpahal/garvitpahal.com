import type { SolveOptions, SolveResult } from '@/puzzles/types'

import { EMPTY, indexOf, type SudokuGrid, type SudokuSolution } from './model'

type Units = {
  /** Every row, column, and region, as lists of cell indices. */
  units: Array<Uint16Array>
  /** For each cell, the other cells sharing a row, column, or region with it. */
  peers: Array<Uint16Array>
}

/** How often to consult the clock during search. Checking every node is measurably slower. */
const TIMEOUT_CHECK_INTERVAL = 2048

function bitOf(value: number): number {
  return 1 << (value - 1)
}

function isSingleBit(mask: number): boolean {
  return mask !== 0 && (mask & (mask - 1)) === 0
}

function popCount(mask: number): number {
  let count = 0
  let remaining = mask
  while (remaining !== 0) {
    remaining &= remaining - 1
    count++
  }
  return count
}

function lowestBitValue(mask: number): number {
  return 31 - Math.clz32(mask & -mask) + 1
}

function buildUnits(grid: SudokuGrid): Units {
  const { n } = grid
  const cellCount = n * n
  const units: Array<Uint16Array> = []

  for (let i = 0; i < n; i++) {
    const row = new Uint16Array(n)
    const col = new Uint16Array(n)
    for (let j = 0; j < n; j++) {
      row[j] = indexOf(n, i, j)
      col[j] = indexOf(n, j, i)
    }
    units.push(row, col)
  }

  const byRegion = new Map<number, Array<number>>()
  for (let cell = 0; cell < cellCount; cell++) {
    const region = grid.regions[cell] ?? 0
    const bucket = byRegion.get(region)
    if (bucket) {
      bucket.push(cell)
    } else {
      byRegion.set(region, [cell])
    }
  }
  for (const cells of byRegion.values()) {
    units.push(Uint16Array.from(cells))
  }

  const peerSets: Array<Set<number>> = Array.from({ length: cellCount }, () => new Set<number>())
  for (const unit of units) {
    for (const cell of unit) {
      const set = peerSets[cell]!
      for (const other of unit) {
        if (other !== cell) {
          set.add(other)
        }
      }
    }
  }

  return {
    units,
    peers: peerSets.map((set) => Uint16Array.from(set)),
  }
}

/** A status union rather than a boolean, so `contradiction` reads explicitly at every call site. */
type Propagation = 'changed' | 'stable' | 'contradiction'

/** Removes a solved cell's value from every peer. */
function eliminateFromPeers(
  candidates: Uint16Array,
  peers: Uint16Array,
  mask: number,
): Propagation {
  let result: Propagation = 'stable'
  for (const peer of peers) {
    const current = candidates[peer]!
    if ((current & mask) !== 0) {
      const next = current & ~mask
      if (next === 0) {
        return 'contradiction'
      }
      candidates[peer] = next
      result = 'changed'
    }
  }
  return result
}

/** Naked singles: a cell with exactly one candidate fixes that value for all its peers. */
function propagateNakedSingles(candidates: Uint16Array, units: Units): Propagation {
  let result: Propagation = 'stable'
  for (const [cell, mask] of candidates.entries()) {
    if (mask === 0) {
      return 'contradiction'
    }
    if (isSingleBit(mask)) {
      const eliminated = eliminateFromPeers(candidates, units.peers[cell]!, mask)
      if (eliminated === 'contradiction') {
        return 'contradiction'
      }
      if (eliminated === 'changed') {
        result = 'changed'
      }
    }
  }
  return result
}

/** How many cells in a unit could still hold `bit`, and the last one seen. */
function countHomesForValue(
  candidates: Uint16Array,
  unit: Uint16Array,
  bit: number,
): { count: number; last: number } {
  let count = 0
  let last = -1
  for (const cell of unit) {
    if ((candidates[cell]! & bit) === 0) {
      continue
    }
    count++
    last = cell
  }
  return { count, last }
}

/** Hidden singles: a value with only one possible home in a unit belongs there. */
function propagateHiddenSinglesInUnit(
  candidates: Uint16Array,
  unit: Uint16Array,
  n: number,
): Propagation {
  let result: Propagation = 'stable'
  for (let value = 1; value <= n; value++) {
    const bit = bitOf(value)
    const { count, last } = countHomesForValue(candidates, unit, bit)
    if (count === 0) {
      return 'contradiction'
    }
    if (count === 1 && candidates[last]! !== bit) {
      candidates[last] = bit
      result = 'changed'
    }
  }
  return result
}

function propagateHiddenSingles(candidates: Uint16Array, units: Units, n: number): Propagation {
  let result: Propagation = 'stable'
  for (const unit of units.units) {
    const propagated = propagateHiddenSinglesInUnit(candidates, unit, n)
    if (propagated === 'contradiction') {
      return 'contradiction'
    }
    if (propagated === 'changed') {
      result = 'changed'
    }
  }
  return result
}

/** Iterates both propagation rules to a fixed point. */
function propagateAll(candidates: Uint16Array, units: Units, n: number): Propagation {
  for (;;) {
    const naked = propagateNakedSingles(candidates, units)
    if (naked === 'contradiction') {
      return 'contradiction'
    }
    const hidden = propagateHiddenSingles(candidates, units, n)
    if (hidden === 'contradiction') {
      return 'contradiction'
    }
    if (naked === 'stable' && hidden === 'stable') {
      return 'stable'
    }
  }
}

type SearchState = {
  units: Units
  n: number
  deadline: number
  nodes: number
  timedOut: boolean
  solutions: Array<Uint8Array>
}

function toValues(candidates: Uint16Array): Uint8Array {
  const values = new Uint8Array(candidates.length)
  for (const [cell, candidate] of candidates.entries()) {
    values[cell] = lowestBitValue(candidate)
  }
  return values
}

/** Depth-first search with minimum-remaining-values ordering. Stops once two solutions are found. */
function search(candidates: Uint16Array, state: SearchState): void {
  if (state.timedOut || state.solutions.length >= 2) {
    return
  }

  state.nodes++
  if (state.nodes % TIMEOUT_CHECK_INTERVAL === 0 && Date.now() > state.deadline) {
    state.timedOut = true
    return
  }

  if (propagateAll(candidates, state.units, state.n) === 'contradiction') {
    return
  }

  let bestCell = -1
  let bestCount = Infinity
  for (const [cell, candidate] of candidates.entries()) {
    const count = popCount(candidate)
    if (count > 1 && count < bestCount) {
      bestCell = cell
      bestCount = count
      if (count === 2) {
        break
      }
    }
  }

  if (bestCell === -1) {
    state.solutions.push(toValues(candidates))
    return
  }

  const mask = candidates[bestCell]!
  for (let value = 1; value <= state.n; value++) {
    const bit = bitOf(value)
    if ((mask & bit) === 0) {
      continue
    }
    const next = Uint16Array.from(candidates)
    next[bestCell] = bit
    search(next, state)
    if (state.timedOut || state.solutions.length >= 2) {
      return
    }
  }
}

export function solveSudoku(grid: SudokuGrid, options: SolveOptions): SolveResult<SudokuSolution> {
  const { n } = grid
  const fullMask = (1 << n) - 1
  const candidates = new Uint16Array(n * n).fill(fullMask)

  for (let cell = 0; cell < grid.values.length; cell++) {
    const value = grid.values[cell] ?? EMPTY
    if (value !== EMPTY) {
      candidates[cell] = bitOf(value)
    }
  }

  const state: SearchState = {
    units: buildUnits(grid),
    n,
    deadline: Date.now() + options.timeoutMs,
    nodes: 0,
    timedOut: false,
    solutions: [],
  }

  search(candidates, state)

  const [first] = state.solutions
  if (state.solutions.length >= 2) {
    return { status: 'multiple', solution: { values: first! } }
  }
  if (first) {
    return { status: 'solved', solution: { values: first } }
  }
  // A timeout with no solution found is reported as such; a completed search with none means the
  // givens contradict each other, which in practice means the grid was misread.
  return state.timedOut ? { status: 'timeout' } : { status: 'unsolvable' }
}
