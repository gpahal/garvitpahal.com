import { useCallback, useRef, useState } from 'react'

import { convexFailure } from '@/lib/convex-errors'
import type { Failure } from '@/lib/failure'
import { retainUnloadWarning } from '@/lib/unload-warning'

type RunOptions = {
  onSuccess?: () => void
  /**
   * Such as `deleting`, which tells a dialog with several writes which one is pending.
   */
  doing?: string
}

export type Submit = {
  isPending: boolean
  pendingDoing: string | undefined
  failure: Failure | undefined
  run: (action: () => Promise<unknown>, options?: RunOptions) => void
}

/**
 * One write at a time: a second tap can land before `isPending` disables the button, so `run` also
 * checks a ref. A pending write holds the unload warning.
 */
export function useSubmit(): Submit {
  const [pending, setPending] = useState<{ doing: string }>()
  const pendingRef = useRef(false)
  const [failure, setFailure] = useState<Failure>()
  const run = useCallback(
    (action: () => Promise<unknown>, { onSuccess, doing = 'saving' }: RunOptions = {}) => {
      if (pendingRef.current) {
        return
      }
      pendingRef.current = true
      setPending({ doing })
      setFailure(undefined)
      const release = retainUnloadWarning()
      const execute = async (): Promise<void> => {
        try {
          await action()
        } catch (error_) {
          setFailure(convexFailure(error_))
          return
        } finally {
          release()
          pendingRef.current = false
          setPending(undefined)
        }
        // Outside the `try`, so a throw here is not reported as a failed write.
        onSuccess?.()
      }
      execute().catch(globalThis.reportError)
    },
    [],
  )
  return {
    isPending: pending !== undefined,
    pendingDoing: pending?.doing,
    failure,
    run,
  }
}
