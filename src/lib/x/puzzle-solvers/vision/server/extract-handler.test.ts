import type { APIContext } from 'astro'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { captureLogs, loggedEvent } from '@/lib/server/test-logs'

import { MAX_IMAGE_BYTES } from '../image-limit'
import type { RateLimitOutcome } from './convex-server'
import {
  createExtractHandler,
  INVALID_REQUEST_MESSAGE,
  MAX_BODY_BYTES,
  serveExtraction,
} from './extract-handler'
import type { ExtractHandlerConfig, ExtractHandlerDeps } from './extract-handler'
import { NOT_CONFIGURED } from './openai-exchange'

type Raw = { cells: Array<number> }

const config: ExtractHandlerConfig<Raw, Raw, Raw, object> = {
  models: {
    initial: [{ id: 'gpt-6-luna' }, { id: 'gpt-6-sol', effort: 'low', tier: 'fast' }],
    fallback: [{ id: 'gpt-6-sol', effort: 'high', tier: 'fast' }],
  },
  hintsSchema: z.strictObject({}),
  prompt: () => 'read it',
  responseSchema: z.strictObject({ cells: z.array(z.int()) }),
  parse: (raw) => ({ ok: true, puzzle: raw }),
  toWire: (puzzle) => puzzle,
  logFields: () => ({}),
}

const VALID_BODY = { data: '/9j/4AAQ', hints: {} }

const INITIAL = '?phase=initial&call=0'

/**
 * Records the order in which the handler reached each dependency and the body.
 */
function setup({
  isConfigured = true,
  rateLimit = { status: 'ok' },
}: { isConfigured?: boolean; rateLimit?: RateLimitOutcome } = {}) {
  const steps: Array<string> = []
  const deps: ExtractHandlerDeps = {
    isConfigured: () => {
      steps.push('config')
      return isConfigured
    },
    consumeRateLimit: async (_owner, cost) => {
      steps.push(`meter ${String(cost)}`)
      return rateLimit
    },
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- fakes a generic dependency
    extractStructured: async <TRaw>() => {
      steps.push('model')
      return { ok: true, data: { cells: [1] } as TRaw }
    },
  }
  const extractions = { test: createExtractHandler(config) }
  const route = async (context: APIContext) => serveExtraction(context, extractions, deps)
  const post = async (body: unknown, { puzzle = 'test', search = INITIAL, headers = {} } = {}) => {
    const text = typeof body === 'string' ? body : JSON.stringify(body)
    const url = new URL(`https://example.test/api/x/puzzle-solvers/${puzzle}${search}`)
    const request = new Request(url, {
      method: 'POST',
      // A high-water mark of zero, so nothing is pulled until the handler reads.
      body: new ReadableStream(
        {
          pull(controller) {
            steps.push('body')
            controller.enqueue(new TextEncoder().encode(text))
            controller.close()
          },
        },
        { highWaterMark: 0 },
      ),
      headers,
      // @ts-expect-error -- Node requires this for a streamed body; the DOM types omit it.
      duplex: 'half',
    })
    // What the `/api/x` gate hands the route.
    const locals = {
      cfContext: { waitUntil: () => undefined },
      owner: { token: 't', requestId: 'r' },
    }
    const response = await route({
      request,
      url,
      params: { puzzle },
      locals,
    } as unknown as APIContext)
    return { status: response.status, json: JSON.parse(await response.text()) as unknown }
  }
  return { steps, post }
}

beforeEach(() => {
  captureLogs()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('extract route', () => {
  it('refuses a missing model key before metering, so it spends no admission', async () => {
    const { steps, post } = setup({ isConfigured: false })
    expect(await post(VALID_BODY)).toEqual({
      status: 503,
      json: { error: { message: NOT_CONFIGURED.message } },
    })
    expect(steps).toEqual(['config'])
  })

  it('refuses a body that declares itself too large before metering', async () => {
    const { steps, post } = setup()
    const headers = { 'content-length': String(MAX_BODY_BYTES + 1) }
    expect(await post(VALID_BODY, { headers })).toMatchObject({ status: 413 })
    expect(steps).toEqual(['config'])
  })

  it.each([
    [{ status: 'limited', retryAfterMs: 1500 }, 429, 'You have reached the limit'],
    [{ status: 'unavailable', cause: 'outage' }, 503, 'Reading is unavailable right now'],
  ] as const)('refuses a %j meter before reading the body', async (rateLimit, status, message) => {
    const { steps, post } = setup({ rateLimit })
    expect(await post(VALID_BODY)).toMatchObject({
      status,
      json: { error: { message: expect.stringContaining(message) as string } },
    })
    expect(steps).toEqual(['config', 'meter 1'])
  })

  /**
   * A JPEG of exactly the cap, which the browser sends, with its base64 padding.
   */
  function jpegAtCap(): string {
    const jpeg = new Uint8Array(MAX_IMAGE_BYTES)
    jpeg.set([0xff, 0xd8, 0xff])
    return Buffer.from(jpeg).toString('base64')
  }
  const envelope = JSON.stringify({ ...VALID_BODY, data: '' }).length
  it.each([
    ['admits a JPEG of exactly the cap', jpegAtCap, 200],
    [
      'refuses a body one byte over the cap',
      () => `/9j/${'A'.repeat(MAX_BODY_BYTES - envelope - 3)}`,
      413,
    ],
  ])('%s after metering', async (_label, data, status) => {
    const { steps, post } = setup()
    expect(await post({ ...VALID_BODY, data: data() })).toMatchObject({ status })
    expect(steps).toEqual(['config', 'meter 1', 'body', ...(status === 200 ? ['model'] : [])])
  })

  it.each([
    ['base64 that is not a JPEG', { ...VALID_BODY, data: 'iVBORw0KGgo=' }, 'invalid_request'],
    ['a model choice', { ...VALID_BODY, model: 'gpt-6-sol' }, 'invalid_request'],
  ])('refuses %s before any model call', async (_label, body, outcome) => {
    const { steps, post } = setup()
    expect(await post(body)).toEqual({
      status: 400,
      json: { error: { message: INVALID_REQUEST_MESSAGE, reload: true, noRetry: true } },
    })
    expect(steps).toEqual(['config', 'meter 1', 'body'])
    expect(loggedEvent('test.done')).toMatchObject({ outcome })
  })

  it.each([
    ['an unknown phase', '?phase=final&call=0'],
    ['a call the chain does not have', '?phase=initial&call=2'],
  ])('refuses %s before metering, so it spends no admission', async (_label, search) => {
    const { steps, post } = setup()
    expect(await post(VALID_BODY, { search })).toEqual({
      status: 400,
      json: { error: { message: INVALID_REQUEST_MESSAGE, reload: true, noRetry: true } },
    })
    expect(steps).toEqual(['config'])
    expect(loggedEvent('test.done')).toMatchObject({ outcome: 'invalid_request' })
  })

  it.each([
    ['a standard initial call', '?phase=initial&call=0', 1],
    ['an initial call on the priority lane', '?phase=initial&call=1', 2],
  ])("meters %s at its model's price", async (_label, search, cost) => {
    const { steps, post } = setup()
    expect(await post(VALID_BODY, { search })).toMatchObject({ status: 200 })
    expect(steps).toEqual(['config', `meter ${String(cost)}`, 'body', 'model'])
  })

  it.each(['chess', '__proto__'])(
    'refuses the unknown puzzle %s without metering',
    async (puzzle) => {
      const { steps, post } = setup()
      expect(await post(VALID_BODY, { puzzle })).toEqual({
        status: 404,
        json: {
          error: {
            message: 'This page is out of date. Reload it and try again',
            reload: true,
            noRetry: true,
          },
        },
      })
      expect(steps).toEqual([])
      expect(loggedEvent('puzzle-solvers.unknown_puzzle')).toMatchObject({ puzzle })
    },
  )
})
