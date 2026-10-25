import { useQuery } from 'convex/react'

import { api } from '@convex/_generated/api'

import { LATER_TODAY_COUNTED, laterTodayLabel } from '@/lib/x/agenda/due-tasks'
import { instantRangeOfDay } from '@/lib/x/agenda/time/dates'
import { useDeviceTimeZone } from '@/hooks/use-device-time-zone'
import { useStandIn } from '@/hooks/use-stand-in'

/**
 * Its own read, from just after now to the end of today, so the count does not depend on the due
 * tasks filling the day's read. It moves each minute, with the last result standing in so the link
 * does not blink out.
 */
export function useLaterToday(isToday: boolean, today: number, now: number): string | undefined {
  const timeZone = useDeviceTimeZone()
  const todayEnd = instantRangeOfDay(today, timeZone).end
  const read = useQuery(
    api.tasks.listScheduled,
    // Just after the minute, since a task at the minute itself is already due.
    isToday ? { start: now + 1, end: todayEnd, limit: LATER_TODAY_COUNTED + 1 } : 'skip',
  )
  const later = useStandIn(read, isToday ? todayEnd : undefined)
  return isToday && later ? laterTodayLabel(later, now) : undefined
}
