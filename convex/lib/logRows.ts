import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/**
 * Keeps a log and its note row together: a note is written only where its log was inserted or
 * read, and goes with it, so a log has at most one note and no note outlives its log.
 */

async function noteRowOf(ctx: QueryCtx, logId: Id<'routineLogs'>) {
  return ctx.db
    .query('routineLogNotes')
    .withIndex('by_logId', (q) => q.eq('logId', logId))
    .unique()
}

export async function readNote(
  ctx: QueryCtx,
  logId: Id<'routineLogs'>,
): Promise<string | undefined> {
  const row = await noteRowOf(ctx, logId)
  return row?.note
}

/**
 * `undefined` clears it.
 */
export async function writeNote(
  ctx: MutationCtx,
  logId: Id<'routineLogs'>,
  note: string | undefined,
): Promise<void> {
  const row = await noteRowOf(ctx, logId)
  if (note === undefined) {
    if (row) {
      await ctx.db.delete('routineLogNotes', row._id)
    }
  } else if (row) {
    if (row.note !== note) {
      await ctx.db.patch('routineLogNotes', row._id, { note })
    }
  } else {
    await ctx.db.insert('routineLogNotes', { logId, note })
  }
}

/**
 * The caller knows the log exists.
 */
export async function deleteLog(ctx: MutationCtx, logId: Id<'routineLogs'>): Promise<void> {
  await writeNote(ctx, logId, undefined)
  await ctx.db.delete('routineLogs', logId)
}
