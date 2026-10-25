import { NAME_REQUIRED_ISSUE } from '@convex/shared/limits'

/**
 * Judged trimmed, sent as typed: trimming is the server's to do.
 */
export function nameError(name: string): string | undefined {
  return name.trim() === '' ? NAME_REQUIRED_ISSUE : undefined
}

export const DATE_TIME_REQUIRED = 'Choose a date and time'
