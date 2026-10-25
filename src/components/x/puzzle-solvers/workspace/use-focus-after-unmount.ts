import { useLayoutEffect, useRef } from 'react'

import { isFocusLost } from '@/lib/final-focus'

export type FocusTarget = 'retry' | 'capture' | 'grid' | 'solve' | 'keep' | 'cancel'

/**
 * Tries each target in order once the render that removes the control has brought them. Moves only
 * focus the unmount dropped, so nothing is taken from the reader.
 */
export function useFocusAfterUnmount(
  isRunning: boolean,
  find: Record<FocusTarget, () => HTMLElement | null | undefined>,
): {
  /**
   * Taken after the next render.
   */
  next: (targets: Array<FocusTarget>) => void
  /**
   * For a job that ends by itself while Cancel has focus. Set on focus, since tabbing to Cancel
   * renders nothing.
   */
  whileCancelFocused: (targets: Array<FocusTarget> | undefined) => void
} {
  const nextRef = useRef<Array<FocusTarget> | undefined>(undefined)
  const cancelRef = useRef<Array<FocusTarget> | undefined>(undefined)
  useLayoutEffect(() => {
    const targets = nextRef.current ?? (isRunning ? undefined : cancelRef.current)
    nextRef.current = undefined
    if (!isRunning) cancelRef.current = undefined
    if (!targets || !isFocusLost()) return
    for (const target of targets) {
      const element = find[target]()
      element?.focus()
      if (element && document.activeElement === element) return
    }
  })
  return {
    next: (targets) => {
      nextRef.current = targets
    },
    whileCancelFocused: (targets) => {
      cancelRef.current = targets
    },
  }
}
