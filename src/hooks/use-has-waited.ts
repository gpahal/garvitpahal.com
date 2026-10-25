import { useEffect, useState } from 'react'

/**
 * For a notice that would only flash if it followed every short wait.
 */
export function useHasWaited(isWaiting: boolean, ms: number): boolean {
  const [hasWaited, setHasWaited] = useState(false)
  useEffect(() => {
    if (!isWaiting) {
      return
    }
    const timeoutId = setTimeout(() => {
      setHasWaited(true)
    }, ms)
    return () => {
      clearTimeout(timeoutId)
      setHasWaited(false)
    }
  }, [isWaiting, ms])
  return isWaiting && hasWaited
}
