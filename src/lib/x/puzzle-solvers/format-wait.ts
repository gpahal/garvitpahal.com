import { formatDuration } from '@convex/shared/durations'

/**
 * Rounded up so it is never shorter than the real wait.
 */
export function formatWait(ms: number): string {
  const seconds = Math.max(Math.ceil(ms / 1000), 1)
  return seconds < 60 ? `${String(seconds)}s` : formatDuration(Math.ceil(seconds / 60))
}
