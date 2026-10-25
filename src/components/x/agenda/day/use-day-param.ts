import { useSyncExternalStore } from 'react'

import { DAY_PARAM, withDayParam } from '@/lib/x/agenda/day'

/**
 * The raw `?day=` value, or `null`. It is read again after each `<ClientRouter />` swap, since a
 * link from a chosen day to Agenda keeps the persisted root mounted with the same props.
 */
export function useDayParam(): string | null {
  return useSyncExternalStore(subscribe, readDayParam)
}

const ownWrites = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  ownWrites.add(onChange)
  globalThis.addEventListener('popstate', onChange)
  document.addEventListener('astro:after-swap', onChange)
  return () => {
    ownWrites.delete(onChange)
    globalThis.removeEventListener('popstate', onChange)
    document.removeEventListener('astro:after-swap', onChange)
  }
}

function readDayParam(): string | null {
  return new URLSearchParams(globalThis.location.search).get(DAY_PARAM)
}

/**
 * Replaces the history entry, keeping its state, rather than pushing one: Astro's router treats
 * every `popstate` carrying state as its own navigation, so Back through pushed days would refetch
 * and swap the page each time.
 */
export function replaceDayParam(choice: number | undefined): void {
  globalThis.history.replaceState(
    globalThis.history.state,
    '',
    withDayParam(globalThis.location.href, choice),
  )
  for (const onChange of ownWrites) {
    onChange()
  }
}
