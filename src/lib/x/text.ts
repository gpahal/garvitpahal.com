/**
 * Copy helpers shared by the `/x` UI and the extraction endpoints, so a count reads the same
 * wherever it is written. Kept free of React and of any server-only import: `parse.ts` runs on the
 * worker and the workspace runs in the browser, and both count the same things.
 */

/**
 * A count and its noun - `pluralize(3, 'cage')` is `'3 cages'`.
 *
 * The number stays a numeral even at one: every caller is interpolating a running total, and "1
 * cage" next to "4 cages" reads as the same sentence with a different count, which is what it is.
 *
 * Pass `plural` for nouns an `s` does not cover.
 */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${String(count)} ${count === 1 ? singular : plural}`
}

/** First character upper-cased, for a fragment written lowercase so it can also be read mid-sentence. */
export function capitalize(s: string): string {
  return s.length === 0 ? s : `${s[0]!.toUpperCase()}${s.slice(1)}`
}
