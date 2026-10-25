import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FORBIDDEN, UNAUTHENTICATED } from '@convex/shared/errorCodes'

import { captureLogs } from '@/lib/server/test-logs'

import { consumeRateLimit } from './convex-server'

vi.mock('astro:env/client', () => ({ PUBLIC_CONVEX_URL: 'https://example.convex.cloud' }))

beforeEach(() => {
  captureLogs()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('consumeRateLimit', () => {
  const refused = (errorData?: string) =>
    Response.json({ status: 'error', errorMessage: 'No', errorData }, { status: 560 })
  // Paid routes refuse both causes.
  it.each([
    [
      'an unreachable deployment',
      async () => {
        throw new TypeError('fetch failed')
      },
      'outage',
    ],
    ['an unexpected refusal', () => refused(), 'outage'],
    ['a gateway page', () => new Response('<html>', { status: 502 }), 'outage'],
    [
      'a verdict of another shape',
      () => Response.json({ status: 'success', value: { allowed: true } }),
      'outage',
    ],
    [
      'an unverified token',
      () => Response.json({ code: 'InvalidAuthHeader' }, { status: 401 }),
      'misconfigured',
    ],
    ['another owner', () => refused(FORBIDDEN), 'misconfigured'],
    ['no identity', () => refused(UNAUTHENTICATED), 'misconfigured'],
  ] as const)('fails closed on %s', async (_label, respond, cause) => {
    vi.stubGlobal('fetch', async () => respond())
    expect(await consumeRateLimit({ token: 'minted', requestId: 'request' }, 1)).toEqual({
      status: 'unavailable',
      cause,
    })
    expect(console.error).toHaveBeenCalledOnce()
  })
})
