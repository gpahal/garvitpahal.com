import { useSyncExternalStore } from 'react'

import { onPageReturn } from '@/lib/page-return'
import { createStore } from '@/lib/store'
import { subscribeMinute } from '@/hooks/use-now'

export function readDeviceTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Nothing announces a change of zone, so it is re-read on return to the page and every minute. One
 * store, since each read builds an `Intl.DateTimeFormat`.
 */
const zone = createStore(readDeviceTimeZone(), (set) => {
  const update = (): void => {
    set(readDeviceTimeZone())
  }
  update()
  const stopReturn = onPageReturn(update)
  const stopMinute = subscribeMinute(update)
  return () => {
    stopReturn()
    stopMinute()
  }
})

/**
 * Browser-only: a prerendered island would bake the build machine's zone into cached HTML, so it
 * throws at build time.
 */
export function useDeviceTimeZone(): string {
  return useSyncExternalStore(zone.subscribe, zone.get, () => {
    throw new Error(
      'useDeviceTimeZone is browser-only: hydrate the island with `client:only="react"`, or take the zone as a prop',
    )
  })
}
