import { useSyncExternalStore } from 'react'

import { onPageReturn } from '@/lib/page-return'
import { createStore } from '@/lib/store'

const MINUTE_MS = 60_000

function currentMinute(): number {
  return Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS
}

/**
 * One timer for every reader, so all turn the minute in one render. The stored minute only decides
 * when to notify; readers take the live one. The margin covers a timer firing early, and
 * `onPageReturn` catches up one a sleeping tab held back.
 */
const minute = createStore(currentMinute(), (set) => {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const arm = (): void => {
    timeout = setTimeout(
      () => {
        // Re-armed before notifying, so a listener that disconnects the store clears the new timer.
        arm()
        set(currentMinute())
      },
      MINUTE_MS - (Date.now() % MINUTE_MS) + 50,
    )
  }
  const catchUp = (): void => {
    set(currentMinute())
  }
  catchUp()
  arm()
  const stopReturn = onPageReturn(catchUp)
  return () => {
    clearTimeout(timeout)
    stopReturn()
  }
})

export const subscribeMinute = minute.subscribe

/**
 * The current instant floored to the minute; `useTickingNow` is for faster readers. Browser-only:
 * a prerendered island would bake the build's minute into cached HTML, and no minute is a neutral
 * server value, so it throws at build time.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribeMinute, currentMinute, () => {
    throw new Error(
      'useNow is browser-only: hydrate the island with `client:only="react"`, or take `now` as a prop',
    )
  })
}
