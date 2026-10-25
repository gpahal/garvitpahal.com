import type { FunctionReference, OptionalRestArgs } from 'convex/server'
import * as z from 'zod/mini'

import { ACCESS_FETCH_INIT, apiRefusalSchema, isAccessSessionExpired } from '@/lib/access-session'
import { callConvexHttp } from '@/lib/convex-http'
import type { Failure } from '@/lib/failure'

const tokenResponseSchema = z.object({ token: z.string().check(z.minLength(1)) })

export type TokenResponse = z.infer<typeof tokenResponseSchema>

/**
 * A request caught by a sleeping laptop can hang for minutes without ever counting as a failure.
 */
const FETCH_TIMEOUT_MS = 10_000

type AccessTokenAnswer =
  Exclude<TokenFetchProblem, { kind: 'rejected' }> | { kind: 'token'; token: string }

export async function readAccessToken(fetchFn: typeof fetch): Promise<AccessTokenAnswer> {
  let response: Response
  try {
    response = await fetchFn('/api/x/token', {
      ...ACCESS_FETCH_INIT,
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch {
    return { kind: 'unreachable' }
  }
  if (isAccessSessionExpired(response)) {
    return { kind: 'expired' }
  }
  try {
    if (response.status === 403 || response.status === 503) {
      // A 403 or 503 without a refusal body, such as a challenge, is `unreadable`.
      const failure = apiRefusalSchema.parse(await response.json()).error
      return { kind: response.status === 503 ? 'unavailable' : 'refused', failure }
    }
    if (!response.ok) {
      return { kind: 'unreadable' }
    }
    const { token } = tokenResponseSchema.parse(await response.json())
    return { kind: 'token', token }
  } catch {
    // A body cut off mid-read is as likely as a wrong one, and either way the server answered.
    return { kind: 'unreadable' }
  }
}

export type TokenCheck = 'accepted' | 'rejected' | 'unknown'

/**
 * Asks Convex over HTTP whether it accepts a token, since rejections on the live connection count
 * towards signing out. `query` should be a cheap owner read: its value is ignored, and its own
 * refusal also means the token got through.
 */
export async function checkConvexToken<TQuery extends FunctionReference<'query'>>(
  fetchFn: typeof fetch,
  convexUrl: string,
  query: TQuery,
  args: TQuery['_args'],
  token: string,
): Promise<TokenCheck> {
  const result = await callConvexHttp(
    { fetchFn, convexUrl, token, timeoutMs: FETCH_TIMEOUT_MS },
    async (client) => client.query(query, ...([args] as OptionalRestArgs<TQuery>)),
  )
  switch (result.kind) {
    case 'rejected': {
      return 'rejected'
    }
    case 'answered':
    case 'refused': {
      return 'accepted'
    }
    case 'unreachable':
    case 'unreadable': {
      return 'unknown'
    }
  }
}

const FIRST_RETRY_DELAY_MS = 1000
const MAX_RETRY_DELAY_MS = 30_000

export const STALLED_AFTER_FAILURES = 4

export type TokenFetchProblem =
  | {
      /**
       * `unreadable` is an answer of no known shape, such as another 5xx or a challenge in front
       * of the Worker.
       */
      kind: 'expired' | 'unreadable' | 'unreachable'
    }
  | {
      /**
       * Convex turned down a newly minted token: the Worker's key and Convex's `CONVEX_JWT_JWKS`
       * disagree, which no sign-in fixes. The next token waits for `tryAgain`.
       */
      kind: 'rejected'
      /**
       * `pending` from a `tryAgain` press until Convex accepts the token; then a failed check's
       * answer until the next press.
       */
      retry: 'none' | 'pending' | Exclude<TokenCheck, 'accepted'>
    }
  | {
      /**
       * `refused` is the route's 403, such as another account or a browser without the page's own
       * fetch metadata. `unavailable` is its 503: a Worker that cannot verify the sign-in or mint
       * a token.
       */
      kind: 'refused' | 'unavailable'
      failure: Failure
    }

/**
 * Problems a retry may end by itself, shown only once quick retries run out. The others show at
 * once.
 */
const TRANSIENT = new Set<TokenFetchProblem['kind']>(['unreadable', 'unavailable', 'unreachable'])

const TRYING: TokenFetchProblem = { kind: 'rejected', retry: 'pending' }

type AccessTokenFetcherOptions = {
  fetchFn: typeof fetch
  /**
   * `woken` when the wait may be over early: the network returned, or the owner came back to the
   * tab, perhaps after signing in again in another.
   */
  sleep: (ms: number) => Promise<'elapsed' | 'woken'>
  /**
   * Settles once the page wants a token again, and at once while it does. The client outlives its
   * pages under view transitions and would otherwise keep fetching, through an expired session
   * too, on every other page.
   */
  whenWanted: () => Promise<void>
  onProblemChange: (problem: TokenFetchProblem | undefined) => void
  checkToken: (token: string) => Promise<TokenCheck>
}

type AccessTokenFetcher = {
  fetchToken: () => Promise<string>
  /**
   * Convex reports `true` when the server rejected its token and it is fetching a replacement, and
   * `false` once one is accepted or it gives up.
   */
  onRefreshChange: (isRefreshing: boolean) => void
  /**
   * Fetches a replacement for a rejected token and hands it to Convex only once a separate check
   * accepts it. Does nothing when no replacement is waiting.
   */
  tryAgain: () => void
}

/**
 * Convex's token fetcher, which never signs the page out. Convex treats `null` as sign-out, which
 * unmounts every open form, and never recovers from a thrown fetch error, so every failure, an
 * expired session included, keeps the fetch pending and retrying with drafts left on screen.
 * Convex also signs out at its third rejected replacement in a row, so after a key mismatch a token
 * reaches Convex only once `checkToken` accepts it.
 */
export function createAccessTokenFetcher({
  fetchFn,
  sleep,
  whenWanted,
  onProblemChange,
  checkToken,
}: AccessTokenFetcherOptions): AccessTokenFetcher {
  let pending: Promise<string> | undefined
  let isRefreshing = false
  let hasReplacedSinceRejection = false
  let shown: TokenFetchProblem | undefined
  let endRejectedWait: ((ending: 'pressed' | 'stopped') => void) | undefined

  // A listener's throw must not become the fetcher's. Each problem is built in one field order, so
  // equal JSON means no change.
  function show(problem: TokenFetchProblem | undefined): void {
    if (JSON.stringify(problem) === JSON.stringify(shown)) {
      return
    }
    shown = problem
    try {
      onProblemChange(problem)
    } catch (error) {
      console.error(error)
    }
  }

  async function readUntilToken(isTrying: boolean): Promise<string> {
    // The owner's retry shows, through quick failures to reach the Worker too, until Convex accepts
    // its token or stops refreshing.
    const quiet = (): TokenFetchProblem | undefined =>
      isTrying && isRefreshing ? TRYING : undefined
    let failures = 0
    let delay = FIRST_RETRY_DELAY_MS
    for (;;) {
      await whenWanted()
      const answer = await readAccessToken(fetchFn)
      if (answer.kind === 'token') {
        show(quiet())
        return answer.token
      }
      let wait: number
      if (TRANSIENT.has(answer.kind)) {
        failures += 1
        // A named problem's notice goes rather than lingering until the quick retries run out.
        show(failures < STALLED_AFTER_FAILURES ? quiet() : answer)
        wait = delay
        delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS)
      } else {
        show(answer)
        failures = 0
        delay = FIRST_RETRY_DELAY_MS
        // Signing in elsewhere or fixing Access ends these; returning to the tab wakes this.
        wait = MAX_RETRY_DELAY_MS
      }
      // The network is often unusable when first reported back, so a wake-up restarts the backoff
      // rather than spending its one early attempt.
      if ((await sleep(wait)) === 'woken') {
        delay = FIRST_RETRY_DELAY_MS
      }
    }
  }

  async function replaceRejected(): Promise<string> {
    let retry: 'none' | Exclude<TokenCheck, 'accepted'> = 'none'
    // Only the owner's press or Convex stopping refreshing ends the wait: no timer, no wake-up.
    for (;;) {
      show({ kind: 'rejected', retry })
      const wait = Promise.withResolvers<'pressed' | 'stopped'>()
      endRejectedWait = wait.resolve
      if ((await wait.promise) === 'stopped') {
        return readUntilToken(false)
      }
      const token = await readUntilToken(true)
      // Convex stopped refreshing meanwhile, so its rejection count restarted and no check is due.
      if (!isRefreshing) {
        return token
      }
      const check = await checkToken(token)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Convex can stop refreshing while the check is awaited
      if (check === 'accepted' || !isRefreshing) {
        return token
      }
      retry = check
    }
  }

  function releaseRejectedWait(ending: 'pressed' | 'stopped'): void {
    const end = endRejectedWait
    endRejectedWait = undefined
    end?.(ending)
  }

  async function fetchThenClearPending(isReplacingRejected: boolean): Promise<string> {
    try {
      const token = await (isReplacingRejected ? replaceRejected() : readUntilToken(false))
      hasReplacedSinceRejection ||= isRefreshing
      return token
    } finally {
      pending = undefined
    }
  }

  return {
    // Tokens are newly minted and short-lived, so a first rejection reads as expiry and is replaced
    // at once. A second before Convex accepts one means a fresh token failed too: the keys disagree.
    fetchToken: async () => {
      pending ??= fetchThenClearPending(isRefreshing && hasReplacedSinceRejection)
      return pending
    },
    onRefreshChange: (refreshing) => {
      isRefreshing = refreshing
      hasReplacedSinceRejection = false
      if (refreshing) {
        return
      }
      releaseRejectedWait('stopped')
      if (shown?.kind === 'rejected') {
        show(undefined)
      }
    },
    tryAgain: () => {
      if (endRejectedWait === undefined) {
        return
      }
      // At once, so the button responds on the press rather than when the fetch resumes.
      show(TRYING)
      releaseRejectedWait('pressed')
    },
  }
}
