import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { handlerTest, OWNER_EMAIL, setup } from './handlerTest.setup'
import { dayOfLocal } from './shared/intervals'
import { DAY_MS } from './shared/limits'

/**
 * Convex registers an export from any file under `convex/` whose name has one dot.
 */
const functionModules = import.meta.glob(
  ['./**/*.{js,mjs,cjs,ts,tsx,mts,cts,jsx}', '!./**/*.*.*', '!./_generated/**'],
  { eager: true },
)

const AT = Date.UTC(2025, 1, 1)
const RANGE = { start: AT, end: AT + DAY_MS, limit: 10 }
const LOG = { started: { at: AT, atLocal: AT }, ended: { at: AT }, timeZone: 'UTC' }
const GOAL = { kind: 'daily' as const, count: 1, reminders: [{ minuteOfDay: 0 }] }

type Ids = { task: Id<'tasks'>; routine: Id<'routines'>; log: Id<'routineLogs'> }

/**
 * Valid arguments, so each refusal comes from the owner check rather than validation.
 */
const ARGS: Record<string, (ids: Ids) => Record<string, unknown>> = {
  'tasks:get': ({ task }) => ({ id: task }),
  'tasks:listOutstanding': () => ({ limit: 10 }),
  'tasks:listScheduled': () => RANGE,
  'tasks:listDone': () => RANGE,
  'tasks:create': () => ({ name: 'Task', showAt: AT }),
  'tasks:update': ({ task }) => ({ id: task, name: 'Renamed' }),
  'tasks:complete': ({ task }) => ({ id: task, done: { at: AT, atLocal: AT, timeZone: 'UTC' } }),
  'tasks:uncomplete': ({ task }) => ({ id: task }),
  'tasks:remove': ({ task }) => ({ id: task }),
  'routines:get': ({ routine }) => ({ id: routine }),
  'routines:list': () => ({}),
  'routines:create': () => ({ name: 'Routine', goal: GOAL }),
  'routines:update': ({ routine }) => ({ id: routine, name: 'Renamed' }),
  'routines:archive': ({ routine }) => ({ id: routine }),
  'routines:restore': ({ routine }) => ({ id: routine }),
  'routines:remove': ({ routine }) => ({ id: routine }),
  'routineLogs:forDialog': ({ routine, log }) => ({
    routineId: routine,
    day: dayOfLocal(AT),
    logId: log,
  }),
  'routineLogs:listForRange': () => RANGE,
  'routineLogs:totalsByRoutine': () => ({ day: dayOfLocal(AT) }),
  'routineLogs:create': ({ routine }) => ({ routineId: routine, ...LOG }),
  'routineLogs:update': ({ log }) => ({ id: log, note: 'Changed' }),
  'routineLogs:remove': ({ log }) => ({ id: log }),
  'rateLimits:consumePuzzleRead': () => ({ cost: 1 }),
  'settings:get': () => ({}),
  'settings:recordTimeZone': () => ({ timeZone: 'UTC' }),
}

function publicFunctions(): Array<{ name: string; isQuery: boolean }> {
  type Registered = { isPublic?: boolean; isQuery?: boolean }
  return Object.entries(functionModules).flatMap(([path, module]) =>
    Object.entries(module as Record<string, Registered | undefined>)
      .filter(([, fn]) => fn?.isPublic === true)
      .map(([exported, fn]) => ({
        name: `${path.slice('./'.length).replace(/\.[^.]+$/, '')}:${exported}`,
        isQuery: fn!.isQuery === true,
      })),
  )
}

afterEach(() => {
  // Restores the owner that the no-owner case stubs away.
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

test('lists every public function, and only those', () => {
  const names = publicFunctions().map(({ name }) => name)
  expect(new Set(names)).toEqual(new Set(Object.keys(ARGS)))
})

test('refuses a stranger and a caller with no identity on every public function', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const t = handlerTest()
  const owner = t.withIdentity({ email: OWNER_EMAIL })
  const routine = await owner.mutation(api.routines.create, { name: 'Routine', goal: GOAL })
  const ids: Ids = {
    task: await owner.mutation(api.tasks.create, { name: 'Task', showAt: AT }),
    routine,
    log: await owner.mutation(api.routineLogs.create, { routineId: routine, ...LOG }),
  }
  const snapshot = async () =>
    t.run(async (ctx) => ({
      tasks: await ctx.db.query('tasks').collect(),
      routines: await ctx.db.query('routines').collect(),
      logs: await ctx.db.query('routineLogs').collect(),
      notes: await ctx.db.query('routineLogNotes').collect(),
      settings: await ctx.db.query('settings').collect(),
    }))
  const before = await snapshot()
  const stranger = t.withIdentity({ email: 'stranger@example.com' })
  for (const { name, isQuery } of publicFunctions()) {
    const args = ARGS[name]!(ids)
    for (const [caller, code] of [
      [stranger, 'Forbidden'],
      [t, 'Unauthenticated'],
    ] as const) {
      const call = isQuery
        ? caller.query(makeFunctionReference<'query'>(name), args)
        : caller.mutation(makeFunctionReference<'mutation'>(name), args)
      await expect(call, `${name} as ${code}`).rejects.toThrow(code)
    }
  }
  expect(await snapshot()).toEqual(before)
  expect(errors).toHaveBeenCalledWith(expect.stringContaining('"event":"auth.not_owner"'))
})

test('refuses even the owner, and logs why, on a deployment with no owner set', async () => {
  vi.stubEnv('OWNER_EMAIL', '')
  const owner = setup()
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  await expect(owner.query(api.routines.list, {})).rejects.toThrow('Forbidden')
  expect(errors.mock.calls.map(([line]) => JSON.parse(String(line)) as unknown)).toEqual([
    { event: 'auth.owner_email_unset' },
  ])
})
