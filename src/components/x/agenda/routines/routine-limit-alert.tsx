import type { ReactNode } from 'react'

import { routineLimitNotice } from '@/lib/x/agenda/routines/routine-limit'
import { NoticeAlert } from '@/components/shared/notice-alert'

import { useRoutines } from './use-routines'

/**
 * Warns as routines near `MAX_ROUTINES` and says at the limit why a new one is refused. A status,
 * not an alert: it is there from the start, not news that interrupts.
 */
export function RoutineLimitAlert(): ReactNode {
  const count = useRoutines()?.length
  const notice = count === undefined ? undefined : routineLimitNotice(count)
  return notice === undefined ? undefined : (
    <NoticeAlert
      message={notice.title}
      description={notice.message}
      tone={notice.isFull ? 'error' : 'warning'}
      announce="status"
    />
  )
}
