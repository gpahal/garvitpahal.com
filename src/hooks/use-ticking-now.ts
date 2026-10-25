import { useEffect, useState } from 'react'

/**
 * For a readout faster than `useNow`'s minute. The tick re-renders the caller, so call it from the
 * readout rather than what surrounds it.
 */
export function useTickingNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
    }, intervalMs)
    return () => {
      clearInterval(id)
    }
  }, [intervalMs])
  return now
}
