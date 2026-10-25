import { ConvexError, v } from 'convex/values'

import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { requireDoc, storedRoutines } from './lib/documents'
import { internalMutation, ownerMutation, ownerQuery } from './lib/functionBuilders'
import { logError } from './lib/log'
import { deleteLog } from './lib/logRows'
import { cleanDescription, cleanName } from './lib/validate'
import schema from './schema'
import type { Goal } from './schema'
import { goalIssue, isActive } from './shared/goalRules'
import { MAX_ROUTINES, MINUTE_MS, ROUTINES_FULL_ISSUE } from './shared/limits'

export const routineValidator = schema.doc('routines')
const routineFieldsValidator = routineValidator.pick('name', 'description', 'goal')

type RoutineFields = typeof routineFieldsValidator.type

function checkedGoal(goal: Goal): Goal {
  const issue = goalIssue(goal)
  if (issue !== undefined) {
    throw new ConvexError(issue)
  }
  return goal
}

/**
 * `null` once it is deleted.
 */
export const get = ownerQuery({
  args: { id: v.id('routines') },
  returns: v.union(routineValidator, v.null()),
  handler: async (ctx, { id }) => {
    return ctx.db.get('routines', id)
  },
})

async function assertRoomForRoutine(ctx: QueryCtx): Promise<void> {
  const stored = await storedRoutines(ctx)
  if (stored.length >= MAX_ROUTINES) {
    throw new ConvexError(ROUTINES_FULL_ISSUE)
  }
}

/**
 * Every routine, archived or not, oldest first: archived ones are few, and one subscription serves
 * both the Agenda screen and the manage page.
 */
export const list = ownerQuery({
  args: {},
  returns: v.array(routineValidator),
  handler: async (ctx) => {
    return storedRoutines(ctx)
  },
})

export const create = ownerMutation({
  args: routineFieldsValidator.fields,
  returns: v.id('routines'),
  handler: async (ctx, { name, description, goal }) => {
    const routine = {
      description: cleanDescription(description),
      goal: checkedGoal(goal),
      name: cleanName(name),
    }
    await assertRoomForRoutine(ctx)
    return ctx.db.insert('routines', routine)
  },
})

/**
 * A field left out is left alone. The goal changes and is checked whole.
 */
export const update = ownerMutation({
  args: { id: v.id('routines'), ...routineFieldsValidator.partial().fields },
  returns: v.null(),
  handler: async (ctx, { id, name, description, goal }) => {
    await requireDoc(ctx, 'routines', id)
    const changes: Partial<RoutineFields> = {}
    if (description !== undefined) {
      changes.description = cleanDescription(description)
    }
    if (goal !== undefined) {
      changes.goal = checkedGoal(goal)
    }
    if (name !== undefined) {
      changes.name = cleanName(name)
    }
    if (Object.keys(changes).length > 0) {
      await ctx.db.patch('routines', id, changes)
    }
    return null
  },
})

/**
 * The server's clock sets the archive instant, where the routine's reminders stop.
 */
export const archive = ownerMutation({
  args: { id: v.id('routines') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const routine = await requireDoc(ctx, 'routines', id)
    if (isActive(routine)) {
      await ctx.db.patch('routines', id, { archivedAt: Date.now() })
    }
    return null
  },
})

/**
 * Nothing records the archived stretch: a restored routine is active from its creation again, so
 * the current interval's reminders are owed as if it had never stopped.
 */
export const restore = ownerMutation({
  args: { id: v.id('routines') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const routine = await requireDoc(ctx, 'routines', id)
    if (!isActive(routine)) {
      await ctx.db.patch('routines', id, { archivedAt: undefined })
    }
    return null
  },
})

/**
 * Each log costs at most 108 reads and 46 writes with aggregate maintenance (eight tree levels, 4 KiB
 * nodes), so a batch with maximum-sized notes fits the transaction limits. Recheck the budget and
 * time a batch on the local backend before raising this or changing aggregate maintenance: the
 * handler tests check transaction limits, not CPU time.
 */
export const LOGS_PER_BATCH = 16

/**
 * Deletes one batch of a deleted routine's logs, and the `routineDeletions` row with the last batch.
 * With no cursor a chain can be rerun, and two chains for one routine share the work. A failed batch
 * rolls back its continuation, so the chain stops on a deterministic error (Convex retries transient
 * ones) until a fix is deployed and `resumeDeletes` restarts it.
 */
async function drain(ctx: MutationCtx, deletionId: Id<'routineDeletions'>): Promise<void> {
  const deletion = await ctx.db.get('routineDeletions', deletionId)
  if (!deletion) {
    return
  }
  const logs = await ctx.db
    .query('routineLogs')
    .withIndex('by_routineId_and_started_atLocal', (q) => q.eq('routineId', deletion.routineId))
    .take(LOGS_PER_BATCH)
  // The trigger wrapper serialises these writes anyway.
  for (const log of logs) {
    await deleteLog(ctx, log._id)
  }
  if (logs.length === LOGS_PER_BATCH) {
    await ctx.scheduler.runAfter(0, internal.routines.drainBatch, { deletionId })
    return
  }
  await ctx.db.delete('routineDeletions', deletionId)
}

/**
 * Only an archived routine, since deleting takes every log and has no undo. The routine goes at once
 * and its logs follow in batches.
 */
export const remove = ownerMutation({
  args: { id: v.id('routines') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const routine = await ctx.db.get('routines', id)
    if (!routine) {
      return null
    }
    if (isActive(routine)) {
      throw new ConvexError('Archive this routine before deleting it')
    }
    await ctx.db.delete('routines', id)
    await drain(ctx, await ctx.db.insert('routineDeletions', { routineId: id }))
    return null
  },
})

export const drainBatch = internalMutation({
  args: { deletionId: v.id('routineDeletions') },
  returns: v.null(),
  handler: async (ctx, { deletionId }) => {
    await drain(ctx, deletionId)
    return null
  },
})

/**
 * Bounds a run's scheduled writes. Later deletions wait only if more than this many drains keep
 * failing.
 */
const DELETIONS_PER_RESUME = 100

/**
 * Counted from the deletion's start, so it must outlast the longest real drain (minutes for tens of
 * thousands of logs).
 */
const STALLED_AFTER_MS = 60 * MINUTE_MS

/**
 * Hourly cron: the owner sees nothing of a stopped chain and cannot restart one. Restarting a chain
 * that has not stopped is harmless, as a second chain drains alongside it.
 */
export const resumeDeletes = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const stalled = await ctx.db
      .query('routineDeletions')
      .withIndex('by_creation_time', (q) => q.lt('_creationTime', Date.now() - STALLED_AFTER_MS))
      .take(DELETIONS_PER_RESUME)
    for (const { _id, routineId, _creationTime } of stalled) {
      // The log is the only sign that chains are breaking.
      logError('routines.delete_resumed', { routineId, deletedAt: _creationTime })
      await ctx.scheduler.runAfter(0, internal.routines.drainBatch, { deletionId: _id })
    }
    return null
  },
})
