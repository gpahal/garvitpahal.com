import { PUBLIC_CONVEX_URL } from 'astro:env/client'

import type { FunctionReturnType } from 'convex/server'
import { ConvexError } from 'convex/values'
import { z } from 'zod'

import { api } from '@convex/_generated/api'
import { FORBIDDEN, UNAUTHENTICATED } from '@convex/shared/errorCodes'

import { callConvexHttp } from '@/lib/convex-http'
import type { Owner } from '@/lib/server/api-gate'
import { errorText, logErrorEvent } from '@/lib/server/log'

const CONVEX_TIMEOUT_MS = 5000

const verdictSchema = z.union([
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), retryAfterMs: z.number() }),
]) satisfies z.ZodType<FunctionReturnType<typeof api.rateLimits.consumePuzzleRead>>

/**
 * The Worker verified this owner moments ago, so these refusals mean the two sides' settings
 * disagree, which no sign-in fixes.
 */
const OWNER_CHECK_CAUSES: ReadonlyMap<unknown, string> = new Map([
  [FORBIDDEN, 'OWNER_EMAIL differs between the Worker and Convex'],
  [UNAUTHENTICATED, "Convex found no identity in the Worker's token"],
])

/**
 * `outage` is no usable answer in time; `misconfigured` an unset `PUBLIC_CONVEX_URL` or Convex
 * refusing the Worker's token or owner. The endpoint refuses paid work on both.
 */
export type RateLimitOutcome =
  | { status: 'ok' }
  | { status: 'limited'; retryAfterMs: number }
  | { status: 'unavailable'; cause: 'outage' | 'misconfigured' }

/**
 * Uses the token the `/api/x` gate minted, so Convex applies the page's owner check, and one Convex
 * transaction holds across every Cloudflare location. Every failure is an outcome, never a throw, so
 * no path skips the refusal; each is logged once under `rate_limit.unavailable`.
 */
export async function consumeRateLimit(
  { token, requestId }: Owner,
  cost: 1 | 2,
): Promise<RateLimitOutcome> {
  const unavailable = (
    cause: 'outage' | 'misconfigured',
    message: string,
  ): Extract<RateLimitOutcome, { status: 'unavailable' }> => {
    logErrorEvent('rate_limit.unavailable', { requestId, cause, message })
    return { status: 'unavailable', cause }
  }
  if (PUBLIC_CONVEX_URL === undefined || PUBLIC_CONVEX_URL === '') {
    return unavailable('misconfigured', 'PUBLIC_CONVEX_URL is not set')
  }
  // Such as a gateway's error page, whose body says nothing Convex's logs do not.
  const unreadable = (status: number): RateLimitOutcome =>
    unavailable('outage', `Convex gave an unreadable answer (HTTP ${String(status)})`)
  const result = await callConvexHttp(
    { fetchFn: fetch, convexUrl: PUBLIC_CONVEX_URL, token, timeoutMs: CONVEX_TIMEOUT_MS },
    async (client) => client.mutation(api.rateLimits.consumePuzzleRead, { cost }),
  )
  switch (result.kind) {
    case 'unreachable': {
      return unavailable('outage', errorText(result.error))
    }
    // This token was minted moments ago, so the two sides' keys disagree.
    case 'rejected': {
      return unavailable(
        'misconfigured',
        "Convex refused the Worker's token: CONVEX_JWT_JWKS does not trust CONVEX_JWT_PRIVATE_KEY",
      )
    }
    case 'unreadable': {
      return unreadable(result.status)
    }
    case 'refused': {
      const { error } = result
      const cause = error instanceof ConvexError ? OWNER_CHECK_CAUSES.get(error.data) : undefined
      return cause === undefined
        ? unavailable('outage', error.message)
        : unavailable('misconfigured', cause)
    }
    case 'answered': {
      const verdict = verdictSchema.safeParse(result.value)
      if (!verdict.success) {
        return unreadable(result.status)
      }
      return verdict.data.ok
        ? { status: 'ok' }
        : { status: 'limited', retryAfterMs: verdict.data.retryAfterMs }
    }
  }
}
