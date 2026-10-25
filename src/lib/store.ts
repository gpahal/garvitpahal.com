type Store<T> = {
  get: () => T
  set: (next: T) => void
  subscribe: (listener: () => void) => () => void
}

/**
 * A module-level value for `useSyncExternalStore`. `connect` runs from the first subscriber, before
 * its listener is added, until the last leaves.
 */
export function createStore<T>(
  initial: T,
  connect?: (set: (next: T) => void) => () => void,
): Store<T> {
  let value = initial
  const listeners = new Set<() => void>()
  let disconnect: (() => void) | undefined
  const set = (next: T): void => {
    if (Object.is(next, value)) {
      return
    }

    value = next
    for (const listener of listeners) {
      listener()
    }
  }
  return {
    get: () => value,
    set,
    subscribe: (listener) => {
      if (listeners.size === 0) {
        disconnect = connect?.(set)
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0) {
          return
        }

        disconnect?.()
        disconnect = undefined
      }
    },
  }
}
