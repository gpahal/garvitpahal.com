import { useEffect, useState } from 'react'

/** Tenths, so the readout visibly moves. Whole seconds look frozen on a fast extraction. */
const TIMER_TICK_MS = 100

/**
 * Extraction has no progress to report, so a moving number is the only signal it has not hung. The
 * clock is state and the interval only re-reads it, keeping `setState` out of the effect body.
 */
export function useElapsedMs(startedAt: number | undefined): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (startedAt === undefined) {
      return
    }

    const id = setInterval(() => {
      setNow(Date.now())
    }, TIMER_TICK_MS)
    return () => {
      clearInterval(id)
    }
  }, [startedAt])

  // `now` is from the previous run until the first tick lands, so it can trail `startedAt`.
  return startedAt === undefined ? 0 : Math.max(0, now - startedAt)
}
