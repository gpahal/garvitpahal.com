import { useQuery } from 'convex/react'

import { api } from '@convex/_generated/api'

import type { Routine } from '@/lib/x/agenda/doc-types'
import { trackRoutines } from '@/lib/x/agenda/routines/schedule'
import type { Tracked } from '@/lib/x/agenda/routines/schedule'
import { useDeviceTimeZone } from '@/hooks/use-device-time-zone'

/**
 * `undefined` while loading.
 */
export function useRoutines(): Array<Routine> | undefined {
  return useQuery(api.routines.list)
}

export type TrackedRoutine = Tracked<Routine>

/**
 * Active routines with where each stands as of `asOf` in its interval around `day`. `undefined`
 * until all of it loads, so a routine never flashes as owed, and while `day` is `undefined`. The
 * totals are one subscription whose arguments change only with the day.
 */
export function useTrackedRoutines(
  routines: Array<Routine> | undefined,
  day: number | undefined,
  asOf: number,
): Array<TrackedRoutine> | undefined {
  const timeZone = useDeviceTimeZone()
  const read = useQuery(api.routineLogs.totalsByRoutine, day === undefined ? 'skip' : { day })

  return routines === undefined || day === undefined || read === undefined
    ? undefined
    : trackRoutines(routines, read, day, asOf, timeZone)
}
