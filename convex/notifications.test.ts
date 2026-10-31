import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from './_generated/api'
import { setup } from './handlerTest.setup'
import { MINUTE_MS } from './shared/limits'
import { toLocal } from './shared/localTime'

const KOLKATA = 'Asia/Kolkata'
const HOUR_MS = 60 * MINUTE_MS

/**
 * 05:00 in Kolkata on Friday 18 September 2026.
 */
const START = Date.parse('2026-09-18T05:00:00+05:30')

function kolkata(iso: string): number {
  return Date.parse(`${iso}+05:30`)
}

const published: Array<Record<string, unknown>> = []

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
  vi.stubEnv('NTFY_URL', 'https://ntfy.example.com')
  vi.stubEnv('NTFY_TOKEN', 'tk_test')
  published.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      published.push(
        JSON.parse(typeof init.body === 'string' ? init.body : '') as Record<string, unknown>,
      )
      return new Response('{}', { status: 200 })
    }),
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

type Test = ReturnType<typeof setup>

/**
 * The retrier starts a publish as a job at the current millisecond, which `convex-test` runs only
 * once the clock has moved past it.
 */
async function drain(t: Test): Promise<void> {
  for (let round = 0; round < 5; round += 1) {
    await t.finishInProgressScheduledFunctions()
    await vi.advanceTimersByTimeAsync(1)
  }
}

/**
 * Steps from one pending job to the next up to `at`, finishing each job's publish before the clock
 * moves on: one jump past them all would fire the retrier's heartbeat while its run was still
 * going, which `convex-test` does not survive. Chains that set their next job stay pending.
 */
async function runUntil(t: Test, at: number): Promise<void> {
  for (;;) {
    const pending = await t.run(async (ctx) =>
      (await ctx.db.system.query('_scheduled_functions').collect())
        .filter(({ state }) => state.kind === 'pending')
        .map(({ scheduledTime }) => scheduledTime),
    )
    const next = Math.min(...pending.filter((time) => time <= at))
    if (!Number.isFinite(next)) {
      break
    }
    await vi.advanceTimersByTimeAsync(Math.max(0, next - Date.now()))
    await drain(t)
  }
  await vi.advanceTimersByTimeAsync(Math.max(0, at - Date.now()))
  await drain(t)
}

async function jobs(t: Test) {
  return t.run(async (ctx) =>
    (await ctx.db.query('notificationJobs').collect()).map(({ key, at }) => ({ key, at })),
  )
}

function titles(): Array<unknown> {
  return published.map((body) => body.title)
}

test('notifies a task at its show-at time, unless it was done, moved or due already', async () => {
  const t = setup()
  const showAt = START + HOUR_MS
  const id = await t.mutation(api.tasks.create, { name: 'Pay rent', showAt })
  await t.mutation(api.tasks.create, { name: 'Due now', showAt: START })
  expect(await jobs(t)).toEqual([{ key: `task:${id}`, at: showAt }])

  const done = { at: START, atLocal: toLocal(START, KOLKATA), timeZone: KOLKATA }
  await t.mutation(api.tasks.complete, { id, done })
  expect(await jobs(t)).toEqual([])
  await t.mutation(api.tasks.uncomplete, { id })
  const moved = START + 2 * HOUR_MS
  await t.mutation(api.tasks.update, { id, showAt: moved })
  expect(await jobs(t)).toEqual([{ key: `task:${id}`, at: moved }])

  await runUntil(t, showAt)
  expect(published).toEqual([])
  await runUntil(t, moved)
  expect(published).toEqual([
    expect.objectContaining({
      topic: 'agenda',
      sequence_id: `task-${id}`,
      title: 'Pay rent',
      message: 'Due now',
    }),
  ])
  expect(await jobs(t)).toEqual([])
})

test('schedules nothing for routines or the summary until a zone is recorded', async () => {
  const t = setup()
  const reminders = [{ minuteOfDay: 9 * 60 }]
  const routine = await t.mutation(api.routines.create, {
    name: 'Run',
    goal: { kind: 'daily', count: 1, reminders },
  })
  expect(await jobs(t)).toEqual([])
  await t.mutation(api.settings.recordTimeZone, { timeZone: KOLKATA })
  expect(await t.query(api.settings.get, {})).toEqual({ timeZone: KOLKATA })
  expect(await jobs(t)).toEqual(
    expect.arrayContaining([
      { key: `routine:${routine}`, at: kolkata('2026-09-18T09:00:00') },
      { key: 'summary', at: kolkata('2026-09-18T06:00:00') },
    ]),
  )
  // Travelling moves both to the new zone's clock.
  await t.mutation(api.settings.recordTimeZone, { timeZone: 'UTC' })
  expect(await jobs(t)).toEqual(
    expect.arrayContaining([
      { key: `routine:${routine}`, at: Date.parse('2026-09-18T09:00:00Z') },
      { key: 'summary', at: Date.parse('2026-09-18T06:00:00Z') },
    ]),
  )
  await expect(t.mutation(api.settings.recordTimeZone, { timeZone: '+05:30' })).rejects.toThrow(
    'is not a time zone this server knows',
  )
})

test('reminds a routine only while it owes, and sets its next reminder each time', async () => {
  const t = setup()
  await t.mutation(api.settings.recordTimeZone, { timeZone: KOLKATA })
  const routineId = await t.mutation(api.routines.create, {
    name: 'Run',
    goal: { kind: 'daily', count: 1, reminders: [{ minuteOfDay: 9 * 60 }] },
  })

  await runUntil(t, kolkata('2026-09-18T09:00:00'))
  expect(published.at(-1)).toEqual(
    expect.objectContaining({ sequence_id: `routine-${routineId}`, message: 'Not done yet today' }),
  )
  expect(await jobs(t)).toContainEqual({
    key: `routine:${routineId}`,
    at: kolkata('2026-09-19T09:00:00'),
  })

  // Logged on the 19th before its reminder, so that one stays quiet.
  await runUntil(t, kolkata('2026-09-19T08:00:00'))
  const at = Date.now() - MINUTE_MS
  await t.mutation(api.routineLogs.create, {
    routineId,
    started: { at, atLocal: toLocal(at, KOLKATA) },
    ended: { at },
    timeZone: KOLKATA,
  })
  await runUntil(t, kolkata('2026-09-19T09:00:00'))
  expect(titles()).toEqual(['1 routine today', 'Run', '1 routine today'])

  await t.mutation(api.routines.archive, { id: routineId })
  expect((await jobs(t)).map(({ key }) => key)).toEqual(['summary'])
})

test('sends the morning summary at 06:00 with what is due by the end of the day', async () => {
  const t = setup()
  await t.mutation(api.settings.recordTimeZone, { timeZone: KOLKATA })
  await t.mutation(api.tasks.create, { name: 'Overdue', showAt: START - HOUR_MS })
  await t.mutation(api.tasks.create, { name: 'Lunch', showAt: kolkata('2026-09-18T12:00:00') })
  await t.mutation(api.tasks.create, { name: 'Next week', showAt: kolkata('2026-09-25T12:00:00') })
  // Its only reminder this week was on Monday, before it existed, so it owes nothing.
  await t.mutation(api.routines.create, {
    name: 'Stretch',
    goal: { kind: 'weekly', count: 1, reminders: [{ weekday: 1, minuteOfDay: 600 }] },
  })
  await t.mutation(api.routines.create, {
    name: 'Read',
    goal: { kind: 'daily', count: 1, reminders: [{ minuteOfDay: 22 * 60 }] },
  })

  await runUntil(t, kolkata('2026-09-18T06:00:00'))
  expect(published).toEqual([
    expect.objectContaining({
      sequence_id: 'summary',
      title: '2 tasks and 1 routine today',
      message: 'Tasks: Overdue, Lunch\nRoutines: Read',
    }),
  ])
  expect(await jobs(t)).toContainEqual({ key: 'summary', at: kolkata('2026-09-19T06:00:00') })
})
