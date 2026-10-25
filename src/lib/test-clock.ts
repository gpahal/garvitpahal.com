import type { SetTimer } from '@/lib/timers'

/**
 * Test-owned time: advancing runs due callbacks in due-time order, ties in registration order,
 * without replacing globals.
 */
export function createTestClock() {
  let now = 0
  const timers = new Set<{ at: number; callback: () => void }>()
  const setTimer: SetTimer = (callback, ms) => {
    const timer = { at: now + ms, callback }
    timers.add(timer)
    return () => {
      timers.delete(timer)
    }
  }
  return {
    now: () => now,
    setTimer,
    pending: () => timers.size,
    advance: (ms: number): void => {
      const until = now + ms
      for (;;) {
        const next = [...timers].toSorted((a, b) => a.at - b.at)[0]
        if (!next || next.at > until) {
          break
        }
        timers.delete(next)
        now = next.at
        next.callback()
      }
      now = until
    },
  }
}
