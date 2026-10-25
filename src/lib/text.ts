/**
 * The number stays a numeral even at one, so "1 item" reads like "4 items".
 */
export function pluralize(count: number, singular: string): string {
  return `${String(count)} ${singular}${count === 1 ? '' : 's'}`
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
