import { parseWhole } from '@/lib/form-fields'

/**
 * `0` for a cage with no clue yet.
 */
export function parseTarget(input: string): number {
  const target = parseWhole(input)
  return target !== undefined && Number.isSafeInteger(target) && target > 0 ? target : 0
}

/**
 * Keeps the field's text while it parses to the stored target, so input in progress is not
 * rewritten under the cursor.
 */
export function shownClue(text: string | undefined, target: number): string {
  const stored = target === 0 ? '' : String(target)
  return text !== undefined && parseTarget(text) === target ? text : stored
}
