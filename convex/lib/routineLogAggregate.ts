import { TableAggregate } from '@convex-dev/aggregate'
import { v } from 'convex/values'
import type { Validator } from 'convex/values'

import { components } from '../_generated/api'
import type { DataModel, Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { spanMs } from '../shared/goalRules'
import type { LogTotals } from '../shared/goalRules'
import type { TimeRange } from '../shared/intervals'

/**
 * Sorted by each log's frozen local start, which decides its interval, and summing elapsed UTC time.
 */
export const routineLogAggregate = new TableAggregate<{
  DataModel: DataModel
  TableName: 'routineLogs'
  Namespace: Id<'routines'>
  Key: number
}>(components.routineLogAggregate, {
  namespace: (log) => log.routineId,
  sortKey: (log) => log.started.atLocal,
  sumValue: spanMs,
})

export const logTotalsValidator = v.object({
  count: v.number(),
  loggedMs: v.number(),
}) satisfies Validator<LogTotals, 'required', string>

export const NO_LOG_TOTALS: LogTotals = { count: 0, loggedMs: 0 }

/**
 * `TableAggregate` has no call returning both, so each batch call walks the tree.
 */
export async function readLogTotals(
  ctx: QueryCtx,
  intervals: Array<{ routineId: Id<'routines'>; interval: TimeRange }>,
): Promise<Array<LogTotals>> {
  const bounds = intervals.map(({ routineId, interval }) => ({
    namespace: routineId,
    bounds: {
      lower: { key: interval.start, inclusive: true },
      upper: { key: interval.end, inclusive: false },
    },
  }))
  const [counts, sums] = await Promise.all([
    routineLogAggregate.countBatch(ctx, bounds),
    routineLogAggregate.sumBatch(ctx, bounds),
  ])
  return counts.map((count, i) => ({ count, loggedMs: sums[i] ?? 0 }))
}
