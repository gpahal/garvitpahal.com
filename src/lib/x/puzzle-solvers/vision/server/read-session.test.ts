import { describe, expect, it } from 'vitest'

import { createTestClock } from '@/lib/test-clock'

import { KEEPALIVE_MS, runReadSession } from './read-session'

/**
 * A session whose call reads `grid` after `callMs` unless aborted first, stepped through at 500 ms
 * so the promise callbacks a timer released run before the next fires.
 */
function start(callMs: number, windowMs = 120_000) {
  const clock = createTestClock()
  const leave = new AbortController()
  const writes: Array<[number, string]> = []
  let callSignal: AbortSignal | undefined
  const ended = runReadSession<string>({
    windowMs,
    signal: leave.signal,
    read: async (signal) => {
      callSignal = signal
      return new Promise((resolve, reject) => {
        const cancel = clock.setTimer(() => resolve({ ok: true, result: 'grid' }), callMs)
        signal.addEventListener('abort', () => {
          cancel()
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    },
    write: (text) => {
      writes.push([clock.now(), text])
      return true
    },
    logError: () => undefined,
    now: clock.now,
    setTimer: clock.setTimer,
  })
  const advance = async (ms: number): Promise<void> => {
    for (let at = 0; at <= ms; at += 500) {
      await new Promise((resolve) => setImmediate(resolve))
      clock.advance(500)
    }
  }
  const body = (): unknown => JSON.parse(writes.map(([, text]) => text).join(''))
  return { leave, writes, ended, advance, body, isCallAborted: () => callSignal?.aborted }
}

describe('runReadSession', () => {
  it('writes whitespace at once and every interval, then the read as one JSON body', async () => {
    const session = start(KEEPALIVE_MS * 2 + 1000)
    await session.advance(KEEPALIVE_MS * 3)
    const blanks = session.writes.filter(([, text]) => text.trim() === '').map(([at]) => at)
    expect(blanks).toEqual([0, KEEPALIVE_MS, KEEPALIVE_MS * 2])
    expect(session.body()).toEqual({ puzzle: 'grid' })
    expect(await session.ended).toMatchObject({ outcome: 'ok', reason: 'settled' })
  })

  it('cuts the call off at the deadline and sends a timeout in its place', async () => {
    const session = start(60_000, 30_000)
    await session.advance(60_000)
    expect(session.isCallAborted()).toBe(true)
    expect(session.body()).toMatchObject({ error: { fallback: true } })
    expect(await session.ended).toMatchObject({ reason: 'deadline', ms: 30_000 })
  })

  it('aborts the call and sends nothing when the browser leaves', async () => {
    const session = start(5000)
    await session.advance(1000)
    session.leave.abort()
    await session.advance(5000)
    expect(session.isCallAborted()).toBe(true)
    expect(session.writes.every(([, text]) => text.trim() === '')).toBe(true)
    expect(await session.ended).toMatchObject({ outcome: 'client_disconnected' })
  })

  it('never calls the model when the browser left before the session began', async () => {
    let calls = 0
    const summary = await runReadSession<string>({
      windowMs: 120_000,
      signal: AbortSignal.abort(),
      read: async () => {
        calls += 1
        return { ok: true, result: 'grid' }
      },
      write: () => true,
      logError: () => undefined,
    })
    expect(calls).toBe(0)
    expect(summary).toMatchObject({ outcome: 'client_disconnected', reason: 'client_disconnected' })
  })
})
