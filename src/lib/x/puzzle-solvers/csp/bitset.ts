/**
 * Value `v` occupies bit `v - 1`.
 */

export function bitOf(value: number): number {
  return (1 << (value - 1)) >>> 0
}

/**
 * Not `(1 << count) - 1`, which is 0 at 32 because shift counts wrap.
 */
export function fullMask(count: number): number {
  return 2 ** count - 1
}

export function isSingleBit(mask: number): boolean {
  return mask !== 0 && (mask & (mask - 1)) === 0
}

export function popCount(mask: number): number {
  let count = 0
  let remaining = mask
  while (remaining !== 0) {
    remaining &= remaining - 1
    count++
  }
  return count
}

export function lowestBitValue(mask: number): number {
  return 32 - Math.clz32(mask & -mask)
}

/**
 * The mask must be non-empty.
 */
export function highestBitValue(mask: number): number {
  return 32 - Math.clz32(mask)
}

/**
 * Clipped to 1..32.
 */
export function rangeMask(low: number, high: number): number {
  const from = Math.max(low, 1)
  const to = Math.min(high, 32)
  return from > to ? 0 : fullMask(to) - fullMask(from - 1)
}
