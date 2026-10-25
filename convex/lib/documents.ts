import { ConvexError, v } from 'convex/values'
import type { Validator } from 'convex/values'

import type { Doc, Id, TableNames } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

const GONE_MESSAGES = {
  tasks: 'This task no longer exists',
  routines: 'This routine no longer exists',
  routineLogs: 'This log no longer exists',
} satisfies Partial<Record<TableNames, string>>

/**
 * Patching a missing document throws an error whose message production redacts, so a document
 * deleted in another tab is reported here instead.
 */
export async function requireDoc<Table extends keyof typeof GONE_MESSAGES>(
  ctx: QueryCtx,
  table: Table,
  id: Id<Table>,
): Promise<Doc<Table>> {
  const doc = await ctx.db.get(table, id)
  if (!doc) {
    throw new ConvexError(GONE_MESSAGES[table])
  }
  return doc
}

/**
 * Unbounded, since writes stop at `MAX_ROUTINES`.
 */
export async function storedRoutines(ctx: QueryCtx): Promise<Array<Doc<'routines'>>> {
  return ctx.db.query('routines').collect()
}

type Takeable<Row> = { take: (count: number) => Promise<Array<Row>> }

export type Capped<Row> = { rows: Array<Row>; hasMore: boolean }

/**
 * A bounded read that says when it was cut. The rows left out are the last in the query's order, so
 * a query that must keep its newest rows reads in descending order.
 */
export async function takeCapped<Row>(query: Takeable<Row>, limit: number): Promise<Capped<Row>> {
  const rows = await query.take(limit + 1)
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit }
}

export function cappedValidator<Row>(row: Validator<Row, 'required', string>) {
  return v.object({ rows: v.array(row), hasMore: v.boolean() })
}
