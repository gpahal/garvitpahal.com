import type { APIContext, MiddlewareHandler } from 'astro'

import type { ApiRefusal } from '@/lib/access-session'
import { SERVER_SETTINGS_MESSAGE } from '@/lib/failure'
import type { OwnerTokenOutcome } from '@/lib/server/convex-token'
import { errorText, getRequestId, refusalResponse, scopedLog } from '@/lib/server/log'
import { isAtOrUnder } from '@/lib/site'

export type Owner = NonNullable<App.Locals['owner']>

/**
 * Refuses cross-origin requests and navigations by browser-owned fetch metadata. Non-browser
 * clients can forge it and same-origin injected scripts pass it, so authorisation still comes from
 * Access and the owner check. Browsers without it, such as Safari before 16.4, and plain-HTTP LAN
 * origins are refused. Same-origin rather than same-site, since the development path mints for any
 * loopback host.
 */
function isOwnFetch(request: Request): boolean {
  return (
    request.headers.get('sec-fetch-site') === 'same-origin' &&
    request.headers.get('sec-fetch-dest') === 'empty'
  )
}

const REFUSED = {
  message:
    'This browser did not send what the server needs to accept the request. Update it, or open this website in another browser',
  noRetry: true,
} as const satisfies ApiRefusal['error']

/**
 * A 401, with no body since the page reads only its status (`src/lib/access-session.ts`), is a
 * session to renew; a 403 is another account; a 503 is a server that could not check, which paid
 * routes fail closed on.
 */
function ownerRefusal(
  outcome: Exclude<OwnerTokenOutcome, { status: 'ok' }>,
  { log, logError }: ReturnType<typeof scopedLog>,
): Response {
  switch (outcome.status) {
    case 'sign_in_required': {
      // Only an expired session is routine: Access forwards a valid JWT on every path it covers,
      // so any other reason is a setting to fix or a forged token.
      const write = outcome.reason === 'expired' ? log : logError
      write('access_refused', { reason: outcome.reason })
      return new Response(null, { status: 401 })
    }
    case 'forbidden': {
      // Access admits only the owner, so this is its policy and `OWNER_EMAIL` disagreeing.
      logError('not_owner')
      return refusalResponse(
        {
          message: "This account is not the owner's. Sign in with the owner's account in a new tab",
          signIn: true,
        },
        403,
      )
    }
    case 'unavailable': {
      logError('auth_unavailable', { cause: outcome.cause, message: outcome.message })
      return refusalResponse(
        {
          message:
            outcome.cause === 'outage'
              ? 'The server cannot check your sign-in right now. Try again shortly'
              : SERVER_SETTINGS_MESSAGE,
        },
        503,
      )
    }
  }
}

/**
 * The `/api/x` route's log name, from Astro's route pattern rather than the path so every spelling
 * Astro routes there, such as `/api/%78/token`, is gated too.
 */
function gatedRouteOf(routePattern: string): string | undefined {
  return isAtOrUnder(routePattern, '/api/x') ? (routePattern.split('/', 4)[3] ?? 'x') : undefined
}

/**
 * For every `/api/x` response, since `public/_headers` reaches static assets only. A route's own
 * value wins, so an endpoint worth caching must say so itself.
 */
export const RESPONSE_HEADERS = {
  'cache-control': 'private, no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'cross-origin-resource-policy': 'same-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-robots-tag': 'noindex, nofollow',
} as const

/**
 * Rebuilt rather than set in place, since a response's headers may be immutable.
 */
function withResponseHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(RESPONSE_HEADERS)) {
    if (!headers.has(name)) {
      headers.set(name, value)
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Refuses, before any body is read, an `/api/x` request that is not the page's own fetch or whose
 * Access JWT is not the owner's. Minting spends no admission, so a paid route meters only the
 * owner.
 */
export function createApiGate({
  ownerTokenFor,
}: {
  ownerTokenFor: (request: Request) => Promise<OwnerTokenOutcome>
}): MiddlewareHandler {
  return async (context, next) => {
    const route = gatedRouteOf(context.routePattern)
    if (route === undefined) {
      return next()
    }
    const { request } = context
    const requestId = getRequestId(request)
    const logs = scopedLog(route, requestId)
    if (!isOwnFetch(request)) {
      // Usually a navigation, so information rather than an error.
      logs.log('not_own_fetch')
      return withResponseHeaders(refusalResponse(REFUSED, 403))
    }
    try {
      const outcome = await ownerTokenFor(request)
      if (outcome.status !== 'ok') {
        return withResponseHeaders(ownerRefusal(outcome, logs))
      }
      context.locals.owner = { token: outcome.token, requestId }
      return withResponseHeaders(await next())
    } catch (error) {
      // Astro's own 500 would go out without the headers every `/api/x` answer carries.
      logs.logError('unexpected_error', { message: errorText(error) })
      return withResponseHeaders(new Response(null, { status: 500 }))
    }
  }
}

/**
 * Throws, so answers 500, for a route the gate did not cover: a bug rather than a caller to refuse.
 */
export function ownerOf(locals: APIContext['locals']): Owner {
  if (!locals.owner) {
    throw new Error('The /api/x gate (src/middleware.ts) did not run for this route')
  }
  return locals.owner
}
