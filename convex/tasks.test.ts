import { expect, test } from 'vitest'

import { api } from './_generated/api'
import { setup } from './handlerTest.setup'
import { DAY_MS } from './shared/limits'
import { toLocal } from './shared/localTime'

const showAt = Date.UTC(2026, 8, 23, 10)

test('completes a task once, storing the zone as sent, and uncompletes it', async () => {
  const t = setup()
  const id = await t.mutation(api.tasks.create, { name: 'Read', showAt })
  const at = Date.now() - 60_000
  const done = { at, atLocal: toLocal(at, 'Asia/Kolkata'), timeZone: 'Asia/Calcutta' }
  await t.mutation(api.tasks.complete, { id, done })
  expect((await t.query(api.tasks.get, { id }))?.done).toEqual(done)
  // A second tab repeats it from another zone: the early return precedes the reading check.
  const later = at + 30_000
  await t.mutation(api.tasks.complete, {
    id,
    done: { at: later, atLocal: later, timeZone: 'UTC' },
  })
  expect((await t.query(api.tasks.get, { id }))?.done).toEqual(done)
  await t.mutation(api.tasks.uncomplete, { id })
  const reopened = await t.query(api.tasks.get, { id })
  expect(reopened).not.toHaveProperty('done')
  // A second tab's repeat is a no-op, not an error.
  await t.mutation(api.tasks.uncomplete, { id })
  expect(await t.query(api.tasks.get, { id })).toEqual(reopened)
})

function ids(result: { rows: Array<{ _id: string }> }): Array<string> {
  return result.rows.map((row) => row._id)
}

test('keeps a completed task out of the outstanding lists and in the done list, half-open', async () => {
  const t = setup()
  const start = Date.UTC(2026, 8, 23)
  const end = start + DAY_MS
  const create = async (name: string, at: number) =>
    t.mutation(api.tasks.create, { name, showAt: at })
  const first = await create('First', start)
  const last = await create('Last', end - 1)
  const next = await create('Next', end)
  const doneAt = Date.now() - 60_000
  await t.mutation(api.tasks.complete, {
    id: first,
    done: { at: doneAt, atLocal: doneAt, timeZone: 'UTC' },
  })
  expect(ids(await t.query(api.tasks.listOutstanding, { limit: 10 }))).toEqual([last, next])
  expect(ids(await t.query(api.tasks.listScheduled, { start, end, limit: 10 }))).toEqual([last])
  expect(
    ids(await t.query(api.tasks.listScheduled, { start: end, end: end + DAY_MS, limit: 10 })),
  ).toEqual([next])
  const done = async (range: { start: number; end: number }) =>
    ids(await t.query(api.tasks.listDone, { ...range, limit: 10 }))
  expect(await done({ start: doneAt, end: doneAt + 1 })).toEqual([first])
  expect(await done({ start: doneAt - DAY_MS, end: doneAt })).toEqual([])
  expect(await done({ start: doneAt + 1, end: doneAt + DAY_MS })).toEqual([])
  await t.mutation(api.tasks.uncomplete, { id: first })
  expect(ids(await t.query(api.tasks.listScheduled, { start, end, limit: 10 }))).toEqual([
    first,
    last,
  ])
  expect(await done({ start: doneAt, end: doneAt + 1 })).toEqual([])
})
