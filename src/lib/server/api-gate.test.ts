import type { APIContext, MiddlewareNext } from 'astro'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OwnerTokenOutcome } from '@/lib/server/convex-token'

import { createApiGate, ownerOf } from './api-gate'
import { captureLogs, loggedLines } from './test-logs'

const OWN_FETCH = { 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'empty' }

const ownerTokenFor = vi.fn<(request: Request) => Promise<OwnerTokenOutcome>>()

const gate = createApiGate({ ownerTokenFor })

type Reached = { locals?: APIContext['locals'] }

async function run(
  routePattern: string,
  headers: Record<string, string>,
  path = routePattern,
  answer: () => Promise<Response> = async () =>
    Response.json(
      { ok: true },
      { headers: { 'cache-control': 'private, no-store, no-transform' } },
    ),
): Promise<{ response: Response; reached: Reached }> {
  const reached: Reached = {}
  const locals = {} as APIContext['locals']
  const context = {
    routePattern,
    request: new Request(`https://example.test${path}`, { headers }),
    locals,
  } as APIContext
  const next: MiddlewareNext = async () => {
    reached.locals = locals
    return answer()
  }
  const response = (await gate(context, next)) as Response
  return { response, reached }
}

beforeEach(() => {
  captureLogs()
  ownerTokenFor.mockResolvedValue({ status: 'ok', token: 'minted' })
})

afterEach(() => {
  vi.restoreAllMocks()
  ownerTokenFor.mockReset()
})

describe('createApiGate', () => {
  it("hands the owner's token to the route, with the headers every response carries", async () => {
    const { response, reached } = await run('/api/x/token', OWN_FETCH)
    expect(reached.locals && ownerOf(reached.locals).token).toBe('minted')
    // eslint-disable-next-line no-console -- asserts on the log sink
    expect(console.log).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
    // Spelled out rather than read from `RESPONSE_HEADERS`, so dropping one from there fails here.
    // The route's own `cache-control` wins.
    expect(Object.fromEntries(response.headers)).toMatchObject({
      'cache-control': 'private, no-store, no-transform',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      'cross-origin-resource-policy': 'same-origin',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-robots-tag': 'noindex, nofollow',
    })
  })

  it("keeps each of a route's repeated headers beside the gate's own", async () => {
    const { response } = await run('/api/x/token', OWN_FETCH, '/api/x/token', async () => {
      const headers = new Headers()
      headers.append('set-cookie', 'a=1')
      headers.append('set-cookie', 'b=2')
      return new Response(null, { headers })
    })
    expect(response.headers.getSetCookie()).toEqual(['a=1', 'b=2'])
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('answers a throw with a bare 500 that still carries the headers, and logs why', async () => {
    const { response } = await run('/api/x/token', OWN_FETCH, '/api/x/token', async () => {
      throw new Error('route bug')
    })
    expect(response.status).toBe(500)
    expect(await response.text()).toBe('')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/"message":"route bug".*"event":"token\.unexpected_error"/),
    )
    ownerTokenFor.mockRejectedValue(new Error('check bug'))
    const checked = await run('/api/x/token', OWN_FETCH)
    expect(checked.response.status).toBe(500)
    expect(checked.response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(checked.reached.locals).toBeUndefined()
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/"message":"check bug".*"event":"token\.unexpected_error"/),
    )
  })

  it('gates any spelling Astro routes to a gated route', async () => {
    const { response, reached } = await run('/api/x/token', {}, '/api/%78/token')
    expect(response.status).toBe(403)
    expect(reached.locals).toBeUndefined()
  })

  it('leaves every other route alone', async () => {
    const { response, reached } = await run('/blog/rss.xml', {})
    expect(response.status).toBe(200)
    expect(response.headers.get('x-robots-tag')).toBeNull()
    expect(reached.locals?.owner).toBeUndefined()
    expect(ownerTokenFor).not.toHaveBeenCalled()
  })

  it.each([
    // A navigation would show the answer in a tab.
    ['a navigation', { 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'document' }],
    ['another site', { 'sec-fetch-site': 'cross-site', 'sec-fetch-dest': 'empty' }],
    [
      'a sibling subdomain or another localhost port',
      { 'sec-fetch-site': 'same-site', 'sec-fetch-dest': 'empty' },
    ],
    ['no fetch metadata', {}],
  ])('refuses %s before anything is minted', async (_label, headers) => {
    const { response, reached } = await run('/api/x/puzzle-solvers/[puzzle]', headers)
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: { noRetry: true } })
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(ownerTokenFor).not.toHaveBeenCalled()
    expect(reached.locals).toBeUndefined()
    // eslint-disable-next-line no-console -- asserts on the log sink
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('"event":"puzzle-solvers.not_own_fetch"'),
    )
  })

  it('answers a missing JWT with a bare 401, which the page reads as an expired session', async () => {
    ownerTokenFor.mockResolvedValue({ status: 'sign_in_required', reason: 'no_access_jwt' })
    const { response, reached } = await run('/api/x/token', OWN_FETCH)
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(reached.locals).toBeUndefined()
  })

  it('answers another account with 403 and the way out', async () => {
    ownerTokenFor.mockResolvedValue({ status: 'forbidden' })
    const { response } = await run('/api/x/token', { ...OWN_FETCH, 'cf-ray': 'ray' })
    expect(loggedLines('error')).toEqual([{ requestId: 'ray', event: 'token.not_owner' }])
    expect(loggedLines('log')).toEqual([])
    expect(response.status).toBe(403)
    // The page shows this message as sent.
    expect(await response.json()).toStrictEqual({
      error: { message: expect.stringContaining("owner's account") as unknown, signIn: true },
    })
  })

  it.each([
    ['misconfigured', 'The server is not set up correctly'],
    ['outage', 'cannot check your sign-in right now'],
  ] as const)(
    'answers a %s Worker with 503, naming the cause but not the detail',
    async (cause, wording) => {
      ownerTokenFor.mockResolvedValue({ status: 'unavailable', cause, message: 'secret detail' })
      const { response } = await run('/api/x/token', { ...OWN_FETCH, 'cf-ray': 'ray' })
      // The log names the detail the answer leaves out.
      expect(loggedLines('error')).toEqual([
        { requestId: 'ray', cause, message: 'secret detail', event: 'token.auth_unavailable' },
      ])
      expect(loggedLines('log')).toEqual([])
      expect(response.status).toBe(503)
      const { error } = (await response.json()) as { error: { message: string } }
      expect(Object.keys(error)).toEqual(['message'])
      expect(error.message).toContain(wording)
      expect(error.message).not.toContain('secret detail')
      expect(response.headers.get('cache-control')).toBe('private, no-store')
    },
  )
})
