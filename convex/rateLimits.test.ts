import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from './_generated/api'
import { setup } from './handlerTest.setup'
import { rateLimiter } from './rateLimits'

/**
 * A refused spend must leave every limit as it was, whichever one refused. Time is frozen between
 * calls, so a bucket is compared as stored.
 */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.UTC(2026, 0, 1))
})
afterEach(() => {
  vi.useRealTimers()
})

async function buckets(t: ReturnType<typeof setup>) {
  return t.query(async (ctx) => {
    const [burst, daily] = await Promise.all(
      (['puzzleReadsBurst', 'puzzleReadsDaily'] as const).map(async (name) =>
        rateLimiter.getValue(ctx, name),
      ),
    )
    return {
      burst: { value: burst!.value, ts: burst!.ts },
      daily: { value: daily!.value, ts: daily!.ts },
    }
  })
}

test.each([
  ['the burst bucket', 'puzzleReadsBurst', 10, 1],
  ['the daily bucket', 'puzzleReadsDaily', 150, 1],
  ['the burst bucket, one short of a priority call', 'puzzleReadsBurst', 9, 2],
  ['the daily bucket, one short of a priority call', 'puzzleReadsDaily', 149, 2],
] as const)('leaves both buckets as they were when %s refuses', async (_, name, count, cost) => {
  const t = setup()
  await t.run(async (ctx) => {
    await rateLimiter.limit(ctx, name, { count, throws: true })
  })
  const before = await buckets(t)
  expect(await t.mutation(api.rateLimits.consumePuzzleRead, { cost })).toMatchObject({
    ok: false,
  })
  expect(await buckets(t)).toEqual(before)
})

test('spends the cost from both buckets', async () => {
  const t = setup()
  let spent = 0
  for (const cost of [1, 2] as const) {
    expect(await t.mutation(api.rateLimits.consumePuzzleRead, { cost })).toEqual({ ok: true })
    spent += cost
    expect(await buckets(t), `after a cost of ${cost}`).toMatchObject({
      burst: { value: 10 - spent },
      daily: { value: 150 - spent },
    })
  }
})
