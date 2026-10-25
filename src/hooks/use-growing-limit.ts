import { useState } from 'react'

export type GrowingLimit = {
  limit: number
  canGrow: boolean
  grow: () => void
}

/**
 * Back to one step under a new key.
 */
export function useGrowingLimit(
  key: unknown,
  { step, max }: { step: number; max: number },
): GrowingLimit {
  const [state, setState] = useState({ key, limit: step })
  // Reset rather than only derived: a stored old key would bring its grown limit back when that key
  // returns.
  if (state.key !== key) {
    setState({ key, limit: step })
  }
  const limit = state.key === key ? state.limit : step
  return {
    limit,
    canGrow: limit < max,
    // From this render's limit, so a double click asks for one step, not two.
    grow: () => {
      setState({ key, limit: Math.min(limit + step, max) })
    },
  }
}
