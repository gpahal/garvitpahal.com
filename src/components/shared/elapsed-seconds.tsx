import type { ReactNode } from 'react'

import { useTickingNow } from '@/hooks/use-ticking-now'

/**
 * Whole seconds look frozen on a short wait.
 */
const TIMER_TICK_MS = 100

/**
 * For a wait with no progress to report. Hidden from assistive tech, as an announced timer would
 * never stop.
 */
export function ElapsedSeconds({ startedAt }: { startedAt: number }): ReactNode {
  const now = useTickingNow(TIMER_TICK_MS)
  // `now` is from the mount until the first tick lands, so it can trail `startedAt`.
  const elapsedMs = Math.max(0, now - startedAt)
  return (
    <span aria-hidden="true" className="tabular-nums">
      {(elapsedMs / 1000).toFixed(1)}s
    </span>
  )
}
