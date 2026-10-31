import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import type { Infer } from 'convex/values'

/**
 * One optional group, as its fields are written and cleared together. Its absence is not-done:
 * indexes are not sparse, so outstanding tasks are the block where `done.at` equals `undefined`.
 */
export const taskDoneValidator = v.object({
  at: v.number(),
  atLocal: v.number(),
  timeZone: v.string(),
})

const tasks = defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  showAt: v.number(),
  done: v.optional(taskDoneValidator),
})
  .index('by_done_at_and_showAt', ['done.at', 'showAt'])
  .index('by_done_atLocal', ['done.atLocal'])

/**
 * Local rules, not instants, resolved against the device's zone when read. A negative `day` counts
 * back from the end of its month.
 */
const dailyReminder = v.object({ minuteOfDay: v.number() })
const weeklyReminder = v.object({ weekday: v.number(), minuteOfDay: v.number() })
const monthlyReminder = v.object({ day: v.number(), minuteOfDay: v.number() })
const yearlyReminder = v.object({ month: v.number(), day: v.number(), minuteOfDay: v.number() })

const goalFields = { count: v.number(), minutesEach: v.optional(v.number()) }

/**
 * The fields sit inside the union so a weekly goal cannot hold a daily reminder, at the cost that
 * editing one reminder replaces the whole goal.
 */
const goalValidator = v.union(
  v.object({ kind: v.literal('daily'), ...goalFields, reminders: v.array(dailyReminder) }),
  v.object({ kind: v.literal('weekly'), ...goalFields, reminders: v.array(weeklyReminder) }),
  v.object({ kind: v.literal('monthly'), ...goalFields, reminders: v.array(monthlyReminder) }),
  v.object({ kind: v.literal('yearly'), ...goalFields, reminders: v.array(yearlyReminder) }),
)

export type Goal = Infer<typeof goalValidator>

const routines = defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  archivedAt: v.optional(v.number()),
  goal: goalValidator,
})

/**
 * Only the start freezes a local reading, as it files the log under a day and an interval. A log is
 * small on purpose: lists read whole documents, so the note is a row of its own.
 */
const routineLogs = defineTable({
  routineId: v.id('routines'),
  started: v.object({ at: v.number(), atLocal: v.number() }),
  ended: v.object({ at: v.number() }),
  timeZone: v.string(),
})
  .index('by_started_atLocal', ['started.atLocal'])
  .index('by_routineId_and_started_atLocal', ['routineId', 'started.atLocal'])

const routineLogNotes = defineTable({
  logId: v.id('routineLogs'),
  note: v.string(),
}).index('by_logId', ['logId'])

/**
 * A deleted routine whose logs are still being removed.
 */
const routineDeletions = defineTable({
  routineId: v.id('routines'),
})

/**
 * One row: the zone an Agenda page last reported, which routine reminders and the morning summary
 * follow. Absent until a page first opens, and until then neither is scheduled.
 */
const settings = defineTable({
  timeZone: v.string(),
})

/**
 * The pending notification for each task, routine and the morning summary, keyed `task:<id>`,
 * `routine:<id>` or `summary`, so a later write can replace or cancel it.
 */
const notificationJobs = defineTable({
  key: v.string(),
  at: v.number(),
  jobId: v.id('_scheduled_functions'),
}).index('by_key', ['key'])

export default defineSchema({
  tasks,
  routines,
  routineLogs,
  routineLogNotes,
  routineDeletions,
  settings,
  notificationJobs,
})
