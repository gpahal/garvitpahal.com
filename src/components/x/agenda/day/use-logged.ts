import { api } from '@convex/_generated/api'
import { localRangeOfDay } from '@convex/shared/intervals'
import { LIST_GROWTH } from '@convex/shared/limits'

import type { Routine, RoutineLog, Task } from '@/lib/x/agenda/doc-types'
import { isReadFurther, mergeLogged } from '@/lib/x/agenda/logged'
import type { LoggedEntry } from '@/lib/x/agenda/logged'
import { useGrowingLimit } from '@/hooks/use-growing-limit'
import type { GrowingLimit } from '@/hooks/use-growing-limit'

import { useGrowingRead } from '../lists/use-growing-read'

type Entry = LoggedEntry<RoutineLog, Task>

export type Logged = {
  /**
   * Newest first. A log whose routine is not in hand, because the routine is deleted and its logs
   * are still draining, is left out: it has no name to show and nothing to open.
   */
  entries: Array<
    Extract<Entry, { kind: 'task' }> | (Extract<Entry, { kind: 'log' }> & { routine: Routine })
  >
  hasMore: boolean
  /**
   * Nothing to show and nothing more to read. A cut record with no row to show yet is not empty.
   */
  isEmpty: boolean
  isLoadingMore: boolean
  growing: GrowingLimit
}

/**
 * `undefined` while either source or the routines load, and while `isEnabled` is false, when
 * nothing is subscribed to. Both sources share one growing limit, newest first, so "Load more" adds
 * older rows.
 */
export function useLogged(
  day: number,
  routines: Array<Routine> | undefined,
  isEnabled: boolean,
): Logged | undefined {
  const growing = useGrowingLimit(day, LIST_GROWTH)
  const args = isEnabled ? { ...localRangeOfDay(day), limit: growing.limit } : 'skip'
  const logs = useGrowingRead(api.routineLogs.listForRange, args)
  const tasks = useGrowingRead(api.tasks.listDone, args)
  const { result: logged } = logs
  const { result: done } = tasks
  if (!logged || !done || !routines) {
    return undefined
  }
  const routineById = new Map(routines.map((routine) => [routine._id, routine]))
  // Judged by the result shown, not the limit asked for: a smaller result stands in while the last
  // raise loads. Once the most one read may ask for has landed, holding rows back would hide them for
  // good.
  const cut = {
    logs: isReadFurther(logged, LIST_GROWTH.max),
    tasks: isReadFurther(done, LIST_GROWTH.max),
  }
  // Dropped after the merge: the cut is measured from the last row read, shown or not.
  const entries = mergeLogged(logged.rows, done.rows, cut).flatMap((entry): Logged['entries'] => {
    if (entry.kind !== 'log') {
      return [entry]
    }
    const routine = routineById.get(entry.log.routineId)
    return routine ? [{ ...entry, routine }] : []
  })
  const hasMore = logged.hasMore || done.hasMore
  return {
    entries,
    hasMore,
    isEmpty: entries.length === 0 && !hasMore,
    isLoadingMore: logs.isLoading || tasks.isLoading,
    growing,
  }
}
