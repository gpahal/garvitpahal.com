import { useEffect } from 'react'

import { useMutation, useQuery } from 'convex/react'

import { api } from '@convex/_generated/api'

import { useDeviceTimeZone } from '@/hooks/use-device-time-zone'

/**
 * Stores the device's zone whenever it differs from the stored one, so routine reminders and the
 * morning summary follow this device (docs/agenda.md, Notifications).
 */
export function RecordTimeZone(): null {
  const timeZone = useDeviceTimeZone()
  const stored = useQuery(api.settings.get)
  const record = useMutation(api.settings.recordTimeZone)

  useEffect(() => {
    if (stored === undefined || stored?.timeZone === timeZone) {
      return
    }
    // Nothing on the page depends on it, so a refusal goes to the console rather than the owner.
    record({ timeZone }).catch((error: unknown) => {
      console.error(error)
    })
  }, [record, stored, timeZone])

  return null
}
