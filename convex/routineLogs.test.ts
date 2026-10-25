import { afterEach, expect, test, vi } from 'vitest'

import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { setup } from './handlerTest.setup'
import { withTriggers } from './lib/functionBuilders'
import { routineLogAggregate } from './lib/routineLogAggregate'
import { LOGS_PER_BATCH } from './routines'
import { spanMs } from './shared/goalRules'
import { dayOfLocal, intervalOfDay } from './shared/intervals'
import { DAY_MS, MAX_NOTE_LENGTH, MINUTE_MS } from './shared/limits'

const START = Date.UTC(2025, 1, 1)
const day = dayOfLocal(START)

const DAILY = { kind: 'daily' as const, count: 1, reminders: [{ minuteOfDay: 0 }] }

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/**
 * Both public queries and the independent source scan share one read-only snapshot.
 */
async function assertPublicTotals(
  t: ReturnType<typeof setup>,
  routineId: Id<'routines'>,
  queryDay: number,
) {
  return t.query(async (ctx) => {
    const dialog = await ctx.runQuery(api.routineLogs.forDialog, { routineId, day: queryDay })
    const all = await ctx.runQuery(api.routineLogs.totalsByRoutine, { day: queryDay })
    if ('gone' in dialog) {
      throw new Error('The routine is gone')
    }
    const { routine } = dialog
    const interval = intervalOfDay(routine.goal.kind, queryDay)
    const matching = (await ctx.db.query('routineLogs').collect()).filter(
      (row) =>
        row.routineId === routineId &&
        row.started.atLocal >= interval.start &&
        row.started.atLocal < interval.end,
    )
    const totals = {
      count: matching.length,
      loggedMs: matching.reduce((sum, log) => sum + spanMs(log), 0),
    }
    expect(dialog.totals).toEqual(totals)
    const dayTotal = all.find((entry) => entry.routineId === routineId)
    if (routine.archivedAt !== undefined) {
      expect(dayTotal).toBeUndefined()
    } else {
      expect(dayTotal).toEqual({ routineId, ...totals })
    }
    return dialog
  })
}

test('reads the log a dialog corrects with its note, and says which of the two went', async () => {
  const t = setup()
  const routineId = await t.mutation(api.routines.create, { name: 'Daily', goal: DAILY })
  const other = await t.mutation(api.routines.create, { name: 'Other', goal: DAILY })
  const logAt = async (at: number, note: string) =>
    t.mutation(api.routineLogs.create, {
      routineId,
      started: { at, atLocal: at },
      ended: { at },
      timeZone: 'UTC',
      note,
    })
  const yesterday = await logAt(START - DAY_MS, 'Yesterday')
  await logAt(START, 'Today')
  // Outside the interval read, yet still the dialog's to correct; the rows carry no note.
  const read = await t.query(api.routineLogs.forDialog, { routineId, day, logId: yesterday })
  expect(read).toMatchObject({
    totals: { count: 1, loggedMs: 0 },
    hasMore: false,
    log: { _id: yesterday, note: 'Yesterday' },
  })
  expect('gone' in read ? undefined : read.rows.map((row) => 'note' in row)).toEqual([false])
  // A new log's dialog reads no log.
  expect(await t.query(api.routineLogs.forDialog, { routineId, day })).not.toHaveProperty('log')
  await expect(
    t.query(api.routineLogs.forDialog, { routineId: other, day, logId: yesterday }),
  ).rejects.toThrow('This log belongs to another routine')
  await t.mutation(api.routineLogs.remove, { id: yesterday })
  expect(await t.query(api.routineLogs.forDialog, { routineId, day, logId: yesterday })).toEqual({
    gone: 'log',
  })
})

test('tracks edits and half-open membership against an independent source scan', async () => {
  const t = setup()
  const routineId = await t.mutation(api.routines.create, { name: 'Daily', goal: DAILY })
  const other = await t.mutation(api.routines.create, { name: 'Other', goal: DAILY })
  const create = async (at: number, duration = 0, id = routineId) =>
    t.mutation(api.routineLogs.create, {
      routineId: id,
      started: { at, atLocal: at },
      ended: { at: at + duration },
      timeZone: 'UTC',
    })
  const assertTotals = async (id = routineId, queryDay = day) => assertPublicTotals(t, id, queryDay)
  await create(START - 1)
  const first = await create(START, 60_000)
  await create(START)
  await create(START + DAY_MS - 1)
  await create(START + DAY_MS)
  await create(START, 120_000, other)
  expect((await assertTotals()).totals).toEqual({ count: 3, loggedMs: 60_000 })
  expect((await assertTotals(other)).totals).toEqual({ count: 1, loggedMs: 120_000 })
  await t.mutation(api.routineLogs.update, { id: first, lengthMs: 180_000 })
  expect((await assertTotals()).totals.loggedMs).toBe(180_000)
  const beforeNote = await t.run(async (ctx) => ctx.db.get('routineLogs', first))
  const beforeAggregate = await t.query(async (ctx) =>
    routineLogAggregate.paginate(ctx, { namespace: routineId, pageSize: 100 }),
  )
  await t.mutation(api.routineLogs.update, { id: first, note: 'Changed note' })
  expect(await t.run(async (ctx) => ctx.db.get('routineLogs', first))).toEqual(beforeNote)
  expect(
    await t.query(async (ctx) =>
      routineLogAggregate.paginate(ctx, { namespace: routineId, pageSize: 100 }),
    ),
  ).toEqual(beforeAggregate)
  expect((await assertTotals()).totals).toEqual({ count: 3, loggedMs: 180_000 })
  await t.mutation(api.routineLogs.update, {
    id: first,
    reading: { started: { at: START + DAY_MS, atLocal: START + DAY_MS }, timeZone: 'UTC' },
  })
  // A moved start keeps the stored length.
  expect((await assertTotals()).totals).toEqual({ count: 2, loggedMs: 0 })
  expect((await assertTotals(routineId, day + 1)).totals).toEqual({ count: 2, loggedMs: 180_000 })
  await t.mutation(api.routineLogs.remove, { id: first })
  await t.mutation(api.routineLogs.remove, { id: first })
  expect((await assertTotals(routineId, day + 1)).totals).toEqual({ count: 1, loggedMs: 0 })
  await t.mutation(api.routines.update, {
    id: routineId,
    goal: { kind: 'monthly', count: 1, minutesEach: 1, reminders: [{ day: 1, minuteOfDay: 0 }] },
  })
  expect((await assertTotals()).totals).toEqual({ count: 3, loggedMs: 0 })
  await t.mutation(api.routines.archive, { id: routineId })
  await assertTotals()
  await t.mutation(api.routines.restore, { id: routineId })
  await assertTotals()
})

/**
 * What deleting a routine leaves behind: nothing, once its drain has run.
 */
async function remainsOf(t: ReturnType<typeof setup>, routineId: Id<'routines'>) {
  return t.run(async (ctx) => ({
    routine: await ctx.db.get('routines', routineId),
    deletions: await ctx.db.query('routineDeletions').collect(),
    logs: await ctx.db.query('routineLogs').collect(),
    notes: await ctx.db.query('routineLogNotes').collect(),
    count: await routineLogAggregate.count(ctx, { namespace: routineId }),
    sum: await routineLogAggregate.sum(ctx, { namespace: routineId }),
  }))
}

const DRAINED = { routine: null, deletions: [], logs: [], notes: [], count: 0, sum: 0 }

/**
 * Leaves the drain to run.
 */
async function deleteRoutineWithLogs(size: number) {
  vi.useFakeTimers()
  const t = setup()
  const routineId = await t.mutation(api.routines.create, { name: 'Delete', goal: DAILY })
  // One transaction through the triggers, so the aggregate stays in step: a mutation per row would
  // take most of the test's time.
  await t.run(async (ctx) => {
    const { db } = withTriggers(ctx)
    for (let i = 0; i < size; i++) {
      const logId = await db.insert('routineLogs', {
        routineId,
        started: { at: START + i, atLocal: START + i },
        ended: { at: START + i + (i % 2 === 0 ? 0 : 60_000) },
        timeZone: 'UTC',
      })
      await db.insert('routineLogNotes', { logId, note: '界'.repeat(MAX_NOTE_LENGTH) })
    }
  })
  await t.mutation(api.routines.archive, { id: routineId })
  await t.mutation(api.routines.remove, { id: routineId })
  await t.mutation(api.routines.remove, { id: routineId })
  expect(await t.query(api.routines.get, { id: routineId })).toBeNull()
  expect(await t.query(api.routineLogs.forDialog, { routineId, day })).toEqual({
    gone: 'routine',
  })
  expect(await t.query(api.routines.list)).toEqual([])
  expect(await t.query(api.routineLogs.totalsByRoutine, { day })).toEqual([])
  // A history shorter than a batch goes in `remove`'s own transaction.
  expect((await remainsOf(t, routineId)).deletions).toHaveLength(size < LOGS_PER_BATCH ? 0 : 1)
  return { t, routineId }
}

test.each([LOGS_PER_BATCH - 1, LOGS_PER_BATCH])(
  'deletes a routine at once and drains its %i logs and notes',
  async (size) => {
    const { t, routineId } = await deleteRoutineWithLogs(size)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await remainsOf(t, routineId)).toEqual(DRAINED)
  },
)

test('resumes a stopped drain', async () => {
  const { t, routineId } = await deleteRoutineWithLogs(LOGS_PER_BATCH * 2 + 1)
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  // convex-test does not run cron schedules, so the cron's handler is called directly.
  const pendingJobs = async () =>
    (await t.run(async (ctx) => ctx.db.system.query('_scheduled_functions').collect())).filter(
      (job) => job.state.kind === 'pending',
    )
  await t.run(async (ctx) => {
    const jobs = await ctx.db.system.query('_scheduled_functions').collect()
    for (const job of jobs) {
      await ctx.scheduler.cancel(job._id)
    }
  })
  // A deletion that may still be draining is left alone.
  await t.mutation(internal.routines.resumeDeletes)
  expect(await pendingJobs()).toEqual([])
  expect(errors).not.toHaveBeenCalled()
  // A stopped one is restarted, with a line in the logs.
  vi.setSystemTime(Date.now() + 61 * MINUTE_MS)
  await t.mutation(internal.routines.resumeDeletes)
  expect(await pendingJobs()).toHaveLength(1)
  expect(errors.mock.calls.map(([line]) => JSON.parse(String(line)) as unknown)).toEqual([
    expect.objectContaining({ event: 'routines.delete_resumed', routineId }),
  ])
  await t.finishAllScheduledFunctions(vi.runAllTimers)
  expect(await remainsOf(t, routineId)).toEqual(DRAINED)
})

test('combines an edit of the length and one of the start from two tabs', async () => {
  const noon = START + 12 * 60 * MINUTE_MS
  const moved = {
    started: { at: noon + 60 * MINUTE_MS, atLocal: noon + 60 * MINUTE_MS },
    timeZone: 'UTC',
  }
  const t = setup()
  const routineId = await t.mutation(api.routines.create, {
    name: 'Walk',
    goal: { ...DAILY, minutesEach: 30 },
  })
  const id = await t.mutation(api.routineLogs.create, {
    routineId,
    started: { at: noon, atLocal: noon },
    ended: { at: noon + 30 * MINUTE_MS },
    timeZone: 'UTC',
  })
  // Each tab opened on 12:00 to 12:30 and changed one field.
  await t.mutation(api.routineLogs.update, { id, lengthMs: 60 * MINUTE_MS })
  await t.mutation(api.routineLogs.update, { id, reading: moved })
  const read = await t.query(api.routineLogs.forDialog, { routineId, day, logId: id })
  expect('gone' in read ? read : read.log).toMatchObject({
    started: moved.started,
    ended: { at: noon + 120 * MINUTE_MS },
  })
  expect((await assertPublicTotals(t, routineId, day)).totals).toEqual({
    count: 1,
    loggedMs: 60 * MINUTE_MS,
  })
})
