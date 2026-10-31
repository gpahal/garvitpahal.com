import { ActionRetrier } from '@convex-dev/action-retrier'

import { components, internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { isActive } from '../shared/goalRules'
import { nextReminderAt } from '../shared/reminders'
import type { Goal } from '../shared/reminders'
import { storedRoutines } from './documents'
import type { Notification } from './ntfy'

/**
 * Retries a publish over about 14 minutes, after which a reminder is stale anyway. `WARN` keeps a
 * line per successful run out of the logs.
 */
const retrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 10_000,
  base: 4,
  maxFailures: 4,
  logLevel: 'WARN',
})

export async function sendNotification(
  ctx: MutationCtx,
  notification: Notification,
): Promise<void> {
  await retrier.run(ctx, internal.ntfy.publish, { notification })
}

export async function storedTimeZone(ctx: QueryCtx): Promise<string | undefined> {
  return (await ctx.db.query('settings').first())?.timeZone
}

type JobKey = `task:${Id<'tasks'>}` | `routine:${Id<'routines'>}` | 'summary'

async function jobOf(ctx: QueryCtx, key: JobKey): Promise<Doc<'notificationJobs'> | null> {
  return ctx.db
    .query('notificationJobs')
    .withIndex('by_key', (q) => q.eq('key', key))
    .unique()
}

/**
 * Replaces `key`'s pending job with one at `at`, or cancels it for `undefined`. A job already set
 * for `at` is kept, so a write that leaves the time alone schedules nothing.
 */
async function setJob(
  ctx: MutationCtx,
  key: JobKey,
  at: number | undefined,
  schedule: (at: number) => Promise<Id<'_scheduled_functions'>>,
): Promise<void> {
  const job = await jobOf(ctx, key)
  if (job?.at === at) {
    return
  }
  if (job) {
    await ctx.scheduler.cancel(job.jobId)
    await ctx.db.delete('notificationJobs', job._id)
  }
  if (at !== undefined) {
    await ctx.db.insert('notificationJobs', { key, at, jobId: await schedule(at) })
  }
}

/**
 * True once, for the job `key` holds for `at`: a fired job that was replaced meanwhile finds another
 * time or no row, and sends nothing.
 */
export async function claimJob(ctx: MutationCtx, key: JobKey, at: number): Promise<boolean> {
  const job = await jobOf(ctx, key)
  if (job?.at !== at) {
    return false
  }
  await ctx.db.delete('notificationJobs', job._id)
  return true
}

/**
 * Only a show-at time still ahead, so a task saved as due now does not notify the device that saved
 * it.
 */
export async function syncTask(
  ctx: MutationCtx,
  taskId: Id<'tasks'>,
  task: Doc<'tasks'> | null,
  now: number,
): Promise<void> {
  const at = task && task.done === undefined && task.showAt > now ? task.showAt : undefined
  await setJob(ctx, `task:${taskId}`, at, async (jobAt) =>
    ctx.scheduler.runAt(jobAt, internal.notifications.taskDue, { taskId, at: jobAt }),
  )
}

export async function syncRoutine(
  ctx: MutationCtx,
  routineId: Id<'routines'>,
  routine: Doc<'routines'> | null,
  timeZone: string | undefined,
  now: number,
): Promise<void> {
  const at =
    timeZone !== undefined && routine && isActive(routine)
      ? nextReminderAt(routine.goal, now, timeZone)
      : undefined
  await setJob(ctx, `routine:${routineId}`, at, async (jobAt) =>
    ctx.scheduler.runAt(jobAt, internal.notifications.routineReminder, { routineId, at: jobAt }),
  )
}

/**
 * 06:00 every day, as a daily goal's reminder would fire.
 */
const MORNING_SUMMARY: Goal = { kind: 'daily', count: 1, reminders: [{ minuteOfDay: 6 * 60 }] }

export async function syncSummary(
  ctx: MutationCtx,
  timeZone: string | undefined,
  now: number,
): Promise<void> {
  const at = timeZone === undefined ? undefined : nextReminderAt(MORNING_SUMMARY, now, timeZone)
  await setJob(ctx, 'summary', at, async (jobAt) =>
    ctx.scheduler.runAt(jobAt, internal.notifications.morningSummary, { at: jobAt }),
  )
}

export async function syncRoutines(
  ctx: MutationCtx,
  timeZone: string | undefined,
  now: number,
): Promise<void> {
  const routines = await storedRoutines(ctx)
  for (const routine of routines) {
    await syncRoutine(ctx, routine._id, routine, timeZone, now)
  }
}
