import { useState } from 'react'

/**
 * `value`, or while it is `undefined` the last one seen under the same key, such as for a dialog
 * animating out after its subject went away. A new key forgets the old key's value.
 */
export function useStandIn<Value>(value: Value | undefined, key: unknown): Value | undefined {
  const [last, setLast] = useState({ value, key })
  if (last.key !== key || (value !== undefined && last.value !== value)) {
    setLast({ value, key })
  }
  return value ?? (last.key === key ? last.value : undefined)
}
