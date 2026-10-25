import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createWireRead } from './extract-client'
import { OUT_OF_DATE_MESSAGE, SIGN_IN_AGAIN_MESSAGE } from './extract-wire'

const READ = { puzzle: { value: 'read puzzle' } }
const DROPPED = { message: 'The connection dropped. Try again' }
const OUT_OF_DATE = { message: OUT_OF_DATE_MESSAGE, reload: true, noRetry: true }

/**
 * One call answered by `respond`, with a refusal arriving at 1000 on the clock.
 */
async function outcomeOf(respond: () => Promise<Response>) {
  const read = createWireRead(
    'test',
    z.object({ value: z.string() }),
    (wire) => wire.value,
    respond,
    () => 1000,
  )
  return read(
    { image: 'cGljdHVyZQ==', hints: {} },
    { phase: 'initial', call: 0, signal: new AbortController().signal },
  )
}

function refusal(status: number, remedy: object = {}, headers: Record<string, string> = {}) {
  return Response.json({ error: { message: 'Server wording', ...remedy } }, { status, headers })
}

describe('createWireRead', () => {
  it('names the phase and call in the query and sends only the picture and hints', async () => {
    const requests: Array<{ url: string; body: unknown }> = []
    const read = createWireRead(
      'test',
      z.object({ value: z.string() }),
      (wire) => wire.value,
      async (input, init) => {
        requests.push({ url: input as string, body: JSON.parse(init?.body as string) })
        return Response.json(READ)
      },
    )
    await read(
      { image: 'cGljdHVyZQ==', hints: { size: 9 } },
      { phase: 'fallback', call: 0, signal: new AbortController().signal },
    )
    expect(requests).toEqual([
      {
        url: '/api/x/puzzle-solvers/test?phase=fallback&call=0',
        body: { data: 'cGljdHVyZQ==', hints: { size: 9 } },
      },
    ])
  })

  it('delivers a read that keepalive whitespace came before, validated and mapped', async () => {
    const response = new Response(`\n\n${JSON.stringify(READ)}`)
    expect(await outcomeOf(async () => response)).toEqual({ ok: true, puzzle: 'read puzzle' })
  })

  const wording = { message: 'Server wording' }
  it.each([
    [
      'a puzzle of an unknown shape',
      () => Response.json({ puzzle: { newerShape: true } }),
      OUT_OF_DATE,
    ],
    ['an answer of an unknown shape', () => Response.json({ type: 'future_answer' }), OUT_OF_DATE],
    ['a body cut short under a 200', () => new Response('\n{"puzzle":'), DROPPED],
    [
      'an expired Access session',
      () => new Response(null, { status: 401 }),
      { message: SIGN_IN_AGAIN_MESSAGE, signIn: true },
    ],
    ['a 429 without retry-after', () => refusal(429), wording],
    [
      'a refusal with a remedy',
      () => refusal(400, { reload: true, noRetry: true }),
      { ...wording, reload: true, noRetry: true },
    ],
    ['a refusal with an unknown remedy', () => refusal(400, { futureRemedy: true }), wording],
    [
      'a 503 that is not JSON',
      () => new Response('<html>', { status: 503 }),
      { message: 'The server ran into a problem while reading the picture. Try again shortly' },
    ],
    [
      'a 404 that is not JSON',
      () => new Response('<html>', { status: 404 }),
      { message: "The server's answer could not be read. Try again" },
    ],
    [
      'an unreachable server',
      async () => {
        throw new TypeError('Failed to fetch')
      },
      {
        message: "Cannot reach the server. Check this device's internet connection, then try again",
      },
    ],
  ])('maps %s', async (_label, respond, error) => {
    expect(await outcomeOf(async () => respond())).toEqual({ ok: false, error })
  })

  it('reads the wait from retry-after as a time from its arrival', async () => {
    const response = refusal(429, {}, { 'retry-after': '12' })
    expect(await outcomeOf(async () => response)).toEqual({
      ok: false,
      error: wording,
      retryAt: 13_000,
    })
  })
})
