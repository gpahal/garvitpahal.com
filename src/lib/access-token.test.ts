import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'

import {
  checkConvexToken,
  createAccessTokenFetcher,
  readAccessToken,
  STALLED_AFTER_FAILURES,
} from './access-token'
import type { TokenCheck, TokenFetchProblem } from './access-token'

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

function answering(...responses: Array<Response | Error>): typeof fetch {
  const queue = [...responses]
  return vi.fn(async () => {
    const next = queue.shift()
    if (!next) {
      throw new Error('fetch called more often than the test allowed')
    }
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  })
}

const FORBIDDEN = { message: "Not the owner's account", signIn: true }

const forbidden = (): Response => json({ error: FORBIDDEN }, 403)

const UNAVAILABLE = { message: 'The server cannot check your sign-in right now. Try again shortly' }

const unavailable = (): Response => json({ error: UNAVAILABLE }, 503)

const redirect = (): Response =>
  Object.defineProperty(new Response(null), 'type', { value: 'opaqueredirect' })

const blip = (): Error => new TypeError('Failed to fetch')

describe('readAccessToken', () => {
  it.each([
    ['a token', json({ token: 'jwt' }), { kind: 'token', token: 'jwt' }],
    ['an account that is not the owner', forbidden(), { kind: 'refused', failure: FORBIDDEN }],
    ["the route's 503", unavailable(), { kind: 'unavailable', failure: UNAVAILABLE }],
    ['a redirect', redirect(), { kind: 'expired' }],
    ["Access's own 401", json({}, 401), { kind: 'expired' }],
    ['a network error', blip(), { kind: 'unreachable' }],
    ['a 5xx', json({ token: 'jwt' }, 503), { kind: 'unreadable' }],
    ['a challenge page', new Response('<html>', { status: 403 }), { kind: 'unreadable' }],
  ])('reads %s', async (_, response, answer) => {
    expect(await readAccessToken(answering(response))).toEqual(answer)
  })

  it('does not follow a redirect', async () => {
    const fetchFn = answering(redirect())
    await readAccessToken(fetchFn)
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/x/token',
      expect.objectContaining({ redirect: 'manual' }),
    )
  })
})

describe('checkConvexToken', () => {
  const QUERY = makeFunctionReference<'query', { limit: number }>('owner:check')

  it.each([
    ['success', json({ status: 'success', value: null }), 'accepted'],
    // The function's own refusal is a token that got through.
    ['a refusal', json({ status: 'error', errorMessage: 'Server Error' }, 560), 'accepted'],
    [
      'a 401',
      json({ code: 'InvalidAuthHeader', message: 'Could not decode token' }, 401),
      'rejected',
    ],
    ['a network error', blip(), 'unknown'],
    ['a portal page', new Response('<html>Portal</html>', { status: 200 }), 'unknown'],
    ['a 560 of another shape', new Response('Oops', { status: 560 }), 'unknown'],
  ] as const)('takes %s as %s', async (_, answer, check) => {
    const url = 'https://example.convex.cloud'
    expect(await checkConvexToken(answering(answer), url, QUERY, { limit: 1 }, 'jwt')).toBe(check)
  })
})

const REJECTION_LABELS = {
  none: 'rejected',
  pending: 'trying',
  rejected: 'still rejected',
  unknown: 'unchecked',
} as const

type SetupOptions = {
  responses: Array<Response | Error>
  wokenFromSleeps?: Array<number>
  /**
   * In order; `accepted` once these run out.
   */
  checks?: Array<TokenCheck>
}

function setup({ responses, wokenFromSleeps = [], checks = [] }: SetupOptions) {
  const checked: Array<string> = []
  const delays: Array<number> = []
  // Kinds, except problems that carry a message, and a rejection by `REJECTION_LABELS`.
  const problems: Array<string | TokenFetchProblem | undefined> = []
  const fetchFn = answering(...responses)
  const { fetchToken, onRefreshChange, tryAgain } = createAccessTokenFetcher({
    fetchFn,
    sleep: async (ms) => {
      delays.push(ms)
      return wokenFromSleeps.includes(delays.length) ? 'woken' : 'elapsed'
    },
    whenWanted: async () => {},
    onProblemChange: (problem) => {
      problems.push(
        problem !== undefined && 'failure' in problem
          ? problem
          : problem?.kind === 'rejected'
            ? REJECTION_LABELS[problem.retry]
            : problem?.kind,
      )
    },
    checkToken: async (token) => {
      checked.push(token)
      return checks.shift() ?? 'accepted'
    },
  })
  return { fetchToken, onRefreshChange, tryAgain, fetchFn, delays, problems, checked }
}

/**
 * Long enough for a fetch that was free to go on to have reached `fetchFn`.
 */
const settle = async (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

describe('createAccessTokenFetcher', () => {
  type RetryCase = [
    label: string,
    failures: Array<Response | Error>,
    wokenFromSleeps: Array<number>,
    delays: Array<number>,
    problems: Array<unknown>,
  ]
  it.each<RetryCase>([
    [
      'an unreachable server, shown once the quick retries run out',
      Array.from({ length: STALLED_AFTER_FAILURES + 4 }, blip),
      [],
      [1000, 2000, 4000, 8000, 16_000, 30_000, 30_000, 30_000],
      ['unreachable', undefined],
    ],
    [
      'an expired session slowly, resuming once it is renewed',
      [redirect(), redirect()],
      [2],
      [30_000, 30_000],
      ['expired', undefined],
    ],
    [
      'with the backoff restarted after an answer that named its problem',
      [blip(), blip(), forbidden(), forbidden(), blip()],
      [],
      [1000, 2000, 30_000, 30_000, 1000],
      [{ kind: 'refused', failure: FORBIDDEN }, undefined],
    ],
    [
      'with the backoff restarted after being woken',
      [blip(), blip(), blip(), blip(), blip()],
      [3],
      [1000, 2000, 4000, 1000, 2000],
      ['unreachable', undefined],
    ],
  ])('retries %s', async (_, failures, wokenFromSleeps, delays, problems) => {
    const fetcher = setup({ responses: [...failures, json({ token: 'jwt' })], wokenFromSleeps })
    expect(await fetcher.fetchToken()).toBe('jwt')
    expect(fetcher.delays).toEqual(delays)
    expect(fetcher.problems).toEqual(problems)
  })

  it('never rejects, even when reporting a problem throws', async () => {
    const failures = Array.from({ length: STALLED_AFTER_FAILURES }, blip)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { fetchToken } = createAccessTokenFetcher({
      fetchFn: answering(...failures, json({ token: 'jwt' })),
      sleep: async () => 'elapsed',
      whenWanted: async () => {},
      checkToken: async () => 'accepted',
      onProblemChange: () => {
        throw new Error('listener failed')
      },
    })
    expect(await fetchToken()).toBe('jwt')
    expect(consoleError).toHaveBeenCalledTimes(2)
    consoleError.mockRestore()
  })

  it('shares one retry loop between concurrent calls', async () => {
    const { fetchToken, delays } = setup({ responses: [blip(), json({ token: 'jwt' })] })
    expect(await Promise.all([fetchToken(), fetchToken()])).toEqual(['jwt', 'jwt'])
    expect(delays).toEqual([1000])
  })

  it('holds a second replacement until the owner tries again', async () => {
    const { fetchToken, onRefreshChange, tryAgain, fetchFn, delays, problems } = setup({
      responses: [
        json({ token: 'first' }),
        json({ token: 'replacement' }),
        json({ token: 'retry' }),
      ],
    })
    expect(await fetchToken()).toBe('first')
    onRefreshChange(true)
    expect(await fetchToken()).toBe('replacement')
    expect(problems).toEqual([])
    // Convex rejected the replacement too, so the keys disagree and nothing is fetched until the
    // owner says to.
    const retry = fetchToken()
    await settle()
    expect(problems).toEqual(['rejected'])
    expect(fetchFn).toHaveBeenCalledTimes(2)
    tryAgain()
    // Said at the press, before the fetch it lets through has begun.
    expect(problems).toEqual(['rejected', 'trying'])
    expect(await retry).toBe('retry')
    expect(delays).toEqual([])
    expect(problems).toEqual(['rejected', 'trying'])
    onRefreshChange(false)
    expect(problems).toEqual(['rejected', 'trying', undefined])
  })

  // A fetch is waiting then only when Convex's auth is reset, by `setAuth`, `clearAuth` or `close`.
  it('stops holding a replacement once Convex stops refreshing', async () => {
    const { fetchToken, onRefreshChange, problems } = setup({
      responses: [json({ token: 'first' }), json({ token: 'late' })],
    })
    onRefreshChange(true)
    expect(await fetchToken()).toBe('first')
    const waiting = fetchToken()
    await settle()
    onRefreshChange(false)
    expect(await waiting).toBe('late')
    expect(problems).toEqual(['rejected', undefined])
  })

  it('hands Convex a retry only once the check accepts it, however many presses it takes', async () => {
    const { fetchToken, onRefreshChange, tryAgain, fetchFn, problems, checked } = setup({
      responses: [
        json({ token: 'first' }),
        json({ token: 'bad' }),
        json({ token: 'unsure' }),
        json({ token: 'good' }),
      ],
      checks: ['rejected', 'unknown', 'accepted'],
    })
    onRefreshChange(true)
    expect(await fetchToken()).toBe('first')
    let isHandedOver = false
    const retry = (async () => {
      const token = await fetchToken()
      isHandedOver = true
      return token
    })()
    await settle()
    tryAgain()
    await settle()
    expect(checked).toEqual(['bad'])
    expect(isHandedOver).toBe(false)
    expect(problems).toEqual(['rejected', 'trying', 'still rejected'])
    tryAgain()
    await settle()
    // An unsure answer is no reason to spend one of Convex's attempts.
    expect(checked).toEqual(['bad', 'unsure'])
    expect(isHandedOver).toBe(false)
    tryAgain()
    expect(await retry).toBe('good')
    expect(fetchFn).toHaveBeenCalledTimes(4)
    expect(problems).toEqual([
      'rejected',
      'trying',
      'still rejected',
      'trying',
      'unchecked',
      'trying',
    ])
    onRefreshChange(false)
    expect(problems.at(-1)).toBeUndefined()
  })

  it('fetches nothing while no page wants a token, before the first fetch or between retries', async () => {
    let resume: (() => void) | undefined
    const fetchFn = answering(redirect(), json({ token: 'renewed' }))
    const { fetchToken } = createAccessTokenFetcher({
      fetchFn,
      sleep: async () => 'elapsed',
      // No page wants a token until `resume`, so each fetch, a retry included, waits for it.
      whenWanted: async () => {
        const wanted = Promise.withResolvers<undefined>()
        resume = () => {
          wanted.resolve(undefined)
        }
        return wanted.promise
      },
      onProblemChange: () => undefined,
      checkToken: async () => 'accepted',
    })
    const token = fetchToken()
    await settle()
    expect(fetchFn).not.toHaveBeenCalled()
    resume?.()
    await settle()
    expect(fetchFn).toHaveBeenCalledTimes(1)
    resume?.()
    expect(await token).toBe('renewed')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})
