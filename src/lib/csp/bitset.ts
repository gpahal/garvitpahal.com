/**
 * Value sets as integer bitmasks. Value `v` occupies bit `v - 1`, so a domain of 1..n fits in the
 * low n bits and set operations are single instructions.
 *
 * Every mask here is unsigned. JS bitwise operators work on Int32, so at 32 values bit 31 comes back
 * negative while a `Uint32Array` reads it back positive - the two never compare equal, and a
 * propagator testing "did this change" would then loop forever. Producing masks unsigned keeps that
 * comparison honest at every width the engine claims to support.
 */

export function bitOf(value: number): number {
  return (1 << (value - 1)) >>> 0
}

/** Every value from 1 to `count`. Exponentiation, not `1 << count`, which is 0 at 32. */
export function fullMask(count: number): number {
  return 2 ** count - 1
}

/** A mask holding exactly one value, meaning the variable is decided. */
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

/** The smallest value in the mask. On a single-bit mask this is the decided value. */
export function lowestBitValue(mask: number): number {
  return 31 - Math.clz32(mask & -mask) + 1
}
