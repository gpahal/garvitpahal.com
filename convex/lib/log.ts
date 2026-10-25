/**
 * One JSON line per event, the event last so no field can overwrite it.
 */
export function logError(event: string, fields: Record<string, string | number> = {}): void {
  console.error(JSON.stringify({ ...fields, event }))
}
