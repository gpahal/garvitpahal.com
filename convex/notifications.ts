import { v } from 'convex/values'

import { storedRoutines, takeCapped } from './lib/documents'
import { internalMutation } from './lib/functionBuilders'
import {
  morningSummaryNotification,
  routineReminderNotification,
  taskDueNotification,
} from './lib/notificationMessages'
import {
  claimJob,
  sendNotification,
  storedTimeZone,
  syncRoutine,
  syncRoutines,
  syncSummary,
} from './lib/notifications'
import { NO_LOG_TOTALS, readLogTotals } from './lib/routineLogAggregate'
import { isActive } from './shared/goalRules'
import { intervalOfDay } from './shared/intervals'
import { dayOfInstant, instantRangeOfDay } from './shared/localTime'
import { routineStatusOf } from './shared/reminders'

/**
 * Each job checks that it is still the one its subject holds (`claimJob`), so one replaced while it
 * was starting sends nothing. Owed counts are read at the time the job runs, not the time it was set
 * for, so a late job does not nag about a routine logged meanwhile.
 */

export const taskDue = internalMutation({
  args: { taskId: v.id('tasks'), at: v.number() },
  returns: v.null(),
  // eslint-disable-next-line sonarjs/no-invariant-returns -- `returns` declares null
  handler: async (ctx, { taskId, at }) => {
    if (!(await claimJob(ctx, `task:${taskId}`, at))) {
      return null
    }
    const task = await ctx.db.get('tasks', taskId)
    if (task && task.done === undefined) {
      await sendNotification(ctx, taskDueNotification(task))
    }
    return null
  },
})

/**
 * Sends only while the routine owes something for the interval, then sets its next reminder.
 */
export const routineReminder = internalMutation({
  args: { routineId: v.id('routines'), at: v.number() },
  returns: v.null(),
  // eslint-disable-next-line sonarjs/no-invariant-returns -- `returns` declares null
  handler: async (ctx, { routineId, at }) => {
    if (!(await claimJob(ctx, `routine:${routineId}`, at))) {
      return null
    }
    const routine = await ctx.db.get('routines', routineId)
    const timeZone = await storedTimeZone(ctx)
    const now = Date.now()
    if (timeZone !== undefined && routine && isActive(routine)) {
      const interval = intervalOfDay(routine.goal.kind, dayOfInstant(now, timeZone))
      const [totals = NO_LOG_TOTALS] = await readLogTotals(ctx, [{ routineId, interval }])
      const { owed } = routineStatusOf(routine, totals, interval, now, timeZone)
      if (owed > 0) {
        await sendNotification(ctx, routineReminderNotification(routine, owed))
      }
    }
    await syncRoutine(ctx, routineId, routine, timeZone, now)
    return null
  },
})

/**
 * Bounds the read; the summary says when it was cut.
 */
const SUMMARY_TASKS_READ = 50

/**
 * Tasks shown by the end of the day and routines owing something by then, as the Agenda screen
 * shows them. It also re-sets every routine's next reminder, which repairs one a bug left unset.
 */
export const morningSummary = internalMutation({
  args: { at: v.number() },
  returns: v.null(),
  // eslint-disable-next-line sonarjs/no-invariant-returns -- `returns` declares null
  handler: async (ctx, { at }) => {
    if (!(await claimJob(ctx, 'summary', at))) {
      return null
    }
    const timeZone = await storedTimeZone(ctx)
    if (timeZone === undefined) {
      return null
    }
    const now = Date.now()
    const day = dayOfInstant(now, timeZone)
    const { end } = instantRangeOfDay(day, timeZone)
    const tasks = await takeCapped(
      ctx.db
        .query('tasks')
        .withIndex('by_done_at_and_showAt', (q) => q.eq('done.at', undefined).lt('showAt', end)),
      SUMMARY_TASKS_READ,
    )
    const tracked = (await storedRoutines(ctx)).filter(isActive).map((routine) => ({
      routine,
      routineId: routine._id,
      interval: intervalOfDay(routine.goal.kind, day),
    }))
    const totals = await readLogTotals(ctx, tracked)
    const owing = tracked
      .filter(({ routine, interval }, i) => {
        // The last instant of the day, as the Agenda screen asks of a day ahead.
        const totalsOf = totals[i] ?? NO_LOG_TOTALS
        return routineStatusOf(routine, totalsOf, interval, end - 1, timeZone).owed > 0
      })
      .map(({ routine }) => routine)
    await sendNotification(
      ctx,
      morningSummaryNotification({
        tasks: tasks.rows.map((task) => task.name),
        hasMoreTasks: tasks.hasMore,
        routines: owing.map((routine) => routine.name),
      }),
    )
    await syncRoutines(ctx, timeZone, now)
    await syncSummary(ctx, timeZone, now)
    return null
  },
})
