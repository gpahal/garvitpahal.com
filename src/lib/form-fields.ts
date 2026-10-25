/**
 * `Number` alone reads `''` as 0 and takes `1e3` and `0x10`.
 */
export function parseWhole(input: string): number | undefined {
  return /^-?\d+$/.test(input.trim()) ? Number(input) : undefined
}

/**
 * Nothing for an unchanged field, so a partial update leaves alone what was changed elsewhere since
 * the form opened.
 */
export function ifChanged<Value>(initial: Value, current: Value): Value | undefined {
  return current === initial ? undefined : current
}

export function idRefs(...ids: Array<string | undefined>): string | undefined {
  return ids.filter((id) => id !== undefined && id !== '').join(' ') || undefined
}
