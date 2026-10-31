import { isActive } from '@convex/shared/goalRules'
import type { LogTotals } from '@convex/shared/goalRules'
import { intervalOfDay } from '@convex/shared/intervals'
import { routineStatusOf } from '@convex/shared/reminders'
import type { RoutineStatus, ScheduledRoutine } from '@convex/shared/reminders'

export type Tracked<TRoutine> = {
  routine: TRoutine
  status: RoutineStatus
}

type RoutineTotal = LogTotals & { routineId: string }

/**
 * Convex applies each write to every query in one transition, so after a goal edit the routines and
 * their totals change together. A missing total returns `undefined`, leaving the section loading
 * rather than counting a routine as having logged nothing.
 */
export function trackRoutines<TRoutine extends ScheduledRoutine & { _id: string }>(
  routines: Array<TRoutine>,
  read: Array<RoutineTotal>,
  day: number,
  now: number,
  timeZone: string,
): Array<Tracked<TRoutine>> | undefined {
  const totalsById = new Map(read.map((entry) => [entry.routineId, entry]))
  const tracked: Array<Tracked<TRoutine>> = []
  for (const routine of routines) {
    if (!isActive(routine)) {
      continue
    }
    const total = totalsById.get(routine._id)
    if (!total) {
      return undefined
    }
    const interval = intervalOfDay(routine.goal.kind, day)
    tracked.push({ routine, status: routineStatusOf(routine, total, interval, now, timeZone) })
  }
  return tracked
}
