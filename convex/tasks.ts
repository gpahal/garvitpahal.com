import { ConvexError, v } from 'convex/values'

import type { QueryCtx } from './_generated/server'
import { cappedValidator, requireDoc, takeCapped } from './lib/documents'
import { ownerMutation, ownerQuery } from './lib/functionBuilders'
import {
  assertDayList,
  assertInstant,
  assertListLimit,
  assertNotFuture,
  assertReading,
  cleanDescription,
  cleanName,
  dayListArgs,
} from './lib/validate'
import schema, { taskDoneValidator } from './schema'
import { CLOCK_TOO_EARLY_ISSUE, EARLIEST_INSTANT } from './shared/limits'
import { latestShowAt, SHOW_AT_TOO_LATE_ISSUE } from './shared/showAt'

const taskValidator = schema.doc('tasks')
const taskFieldsValidator = taskValidator.pick('name', 'description', 'showAt')

type TaskFields = typeof taskFieldsValidator.type

const taskListValidator = cappedValidator(taskValidator)

/**
 * Oldest show-at time first.
 */
function outstanding(ctx: QueryCtx, showAt?: { start: number; end: number }) {
  return ctx.db.query('tasks').withIndex('by_done_at_and_showAt', (q) => {
    const open = q.eq('done.at', undefined)
    return showAt ? open.gte('showAt', showAt.start).lt('showAt', showAt.end) : open
  })
}

/**
 * Asked of a show-at time a save sets, so a stored one further ahead is kept.
 */
function assertShowAtInReach(showAt: number): void {
  // The form refuses a typed date this early itself, so here the time is the device clock's.
  if (showAt < EARLIEST_INSTANT) {
    throw new ConvexError(CLOCK_TOO_EARLY_ISSUE)
  }
  // Negated so that `NaN` fails too, without relying on `assertInstant` having run first.
  if (!(showAt <= latestShowAt(Date.now()))) {
    throw new ConvexError(SHOW_AT_TOO_LATE_ISSUE)
  }
}

/**
 * `null` once it is deleted.
 */
export const get = ownerQuery({
  args: { id: v.id('tasks') },
  returns: v.union(taskValidator, v.null()),
  handler: async (ctx, { id }) => {
    return ctx.db.get('tasks', id)
  },
})

/**
 * Including those not shown yet. There is no 'due' variant: due tasks lead this list, and a time
 * argument would cost a new subscription every minute.
 */
export const listOutstanding = ownerQuery({
  args: { limit: v.number() },
  returns: taskListValidator,
  handler: async (ctx, { limit }) => {
    assertListLimit(limit)
    return takeCapped(outstanding(ctx), limit)
  },
})

/**
 * Outstanding tasks that start showing within a day still ahead.
 */
export const listScheduled = ownerQuery({
  args: dayListArgs,
  returns: taskListValidator,
  handler: async (ctx, { start, end, limit }) => {
    assertDayList({ start, end, limit })
    return takeCapped(outstanding(ctx, { start, end }), limit)
  },
})

/**
 * Newest first, so a cut read keeps the latest.
 */
export const listDone = ownerQuery({
  args: dayListArgs,
  returns: taskListValidator,
  handler: async (ctx, { start, end, limit }) => {
    assertDayList({ start, end, limit })
    return takeCapped(
      ctx.db
        .query('tasks')
        .withIndex('by_done_atLocal', (q) => q.gte('done.atLocal', start).lt('done.atLocal', end))
        .order('desc'),
      limit,
    )
  },
})

/**
 * `showAt` is an instant: the form reads a typed time in its own zone before sending it.
 */
export const create = ownerMutation({
  args: taskFieldsValidator.fields,
  returns: v.id('tasks'),
  handler: async (ctx, { name, description, showAt }) => {
    const task = { description: cleanDescription(description), name: cleanName(name), showAt }
    assertInstant(showAt, 'Show-at time')
    assertShowAtInReach(showAt)
    return ctx.db.insert('tasks', task)
  },
})

/**
 * A field left out is left alone, so a form cannot write a stale copy over another tab's change.
 * Only the fields sent are checked. An empty description clears it.
 */
export const update = ownerMutation({
  args: { id: v.id('tasks'), ...taskFieldsValidator.partial().fields },
  returns: v.null(),
  handler: async (ctx, { id, name, description, showAt }) => {
    const task = await requireDoc(ctx, 'tasks', id)
    const changes: Partial<TaskFields> = {}
    if (description !== undefined) {
      changes.description = cleanDescription(description)
    }
    if (name !== undefined) {
      changes.name = cleanName(name)
    }
    if (showAt !== undefined) {
      assertInstant(showAt, 'Show-at time')
      if (showAt !== task.showAt) {
        assertShowAtInReach(showAt)
      }
      changes.showAt = showAt
    }
    if (Object.keys(changes).length > 0) {
      await ctx.db.patch('tasks', id, changes)
    }
    return null
  },
})

/**
 * The local reading is taken once, keeping the task on its day. Both ends of the instant are
 * bounded, as a device clock set too early would file the task on a day the picker cannot reach,
 * leaving nothing to undo it with.
 */
export const complete = ownerMutation({
  args: { id: v.id('tasks'), done: taskDoneValidator },
  returns: v.null(),
  // eslint-disable-next-line sonarjs/no-invariant-returns -- `returns` declares null
  handler: async (ctx, { id, done }) => {
    // First, so a task deleted elsewhere is reported as gone.
    const task = await requireDoc(ctx, 'tasks', id)
    if (task.done) {
      return null
    }
    assertReading(done, done.timeZone, 'Completion time', CLOCK_TOO_EARLY_ISSUE)
    assertNotFuture(done.at)
    await ctx.db.patch('tasks', id, { done })
    return null
  },
})

export const uncomplete = ownerMutation({
  args: { id: v.id('tasks') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const task = await requireDoc(ctx, 'tasks', id)
    if (task.done) {
      await ctx.db.patch('tasks', id, { done: undefined })
    }
    return null
  },
})

export const remove = ownerMutation({
  args: { id: v.id('tasks') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    if (await ctx.db.get('tasks', id)) {
      await ctx.db.delete('tasks', id)
    }
    return null
  },
})
