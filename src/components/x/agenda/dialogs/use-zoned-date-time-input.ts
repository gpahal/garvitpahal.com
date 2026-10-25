import { useState } from 'react'

import { fromDateTimeInput } from '@/lib/x/agenda/time/dates'
import { readDeviceTimeZone } from '@/hooks/use-device-time-zone'

/**
 * The device's zone as the form opened, read once, so a change of zone while it is open moves
 * nothing typed.
 */
export function useFormTimeZone(): string {
  const [zone] = useState(readDeviceTimeZone)
  return zone
}

type Untouched = {
  /**
   * The exact instant, which the input's minutes cannot always name: it may have seconds, and the
   * later side of a clocks-back repeat reads the same as the earlier one.
   */
  at: number
  input: string
}

export type ZonedDateTimeInput = {
  zone: string
  input: string
  setInput: (input: string) => void
  /**
   * Still holding what it was filled from, or typed back to it.
   */
  isUntouched: boolean
  /**
   * The instant the input names; `undefined` while it is incomplete.
   */
  at: number | undefined
}

/**
 * `untouched` is read every render, so an untouched input follows a default that depends on another
 * field, such as a new log's start on its duration. A typed value is never rewritten.
 */
export function useZonedDateTimeInput(zone: string, untouched: Untouched): ZonedDateTimeInput {
  const [typed, setTyped] = useState<string>()
  const isUntouched = typed === undefined
  return {
    zone,
    input: typed ?? untouched.input,
    setInput: (input) => {
      setTyped(input === untouched.input ? undefined : input)
    },
    isUntouched,
    at: isUntouched ? untouched.at : fromDateTimeInput(typed, zone),
  }
}
