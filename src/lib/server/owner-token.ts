import {
  ACCESS_AUD,
  ACCESS_TEAM_DOMAIN,
  CONVEX_JWT_PRIVATE_KEY,
  OWNER_EMAIL,
} from 'astro:env/server'

import { createAccessJwtVerifier } from '@/lib/server/access-jwt'
import { createSigningKeyCache, issueOwnerToken } from '@/lib/server/convex-token'
import type { OwnerTokenOutcome } from '@/lib/server/convex-token'
import { mintDevOwnerToken } from '@/lib/server/dev-owner-token'

/**
 * One of each per isolate, so the Access certs and signing key are not redone per request.
 */
const verify = createAccessJwtVerifier({
  fetchFn: fetch,
  now: Date.now,
})
const signingKey = createSigningKeyCache()

const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * The only requests the development path signs in. Cloudflare always adds `cf-ray`, so this is
 * false behind it. The checks refuse a tunnel or proxy in front of `pnpm dev`, but one that
 * rewrites the host and adds no proxy header still passes. `x-forwarded-host` is no sign of a
 * proxy: `@cloudflare/vite-plugin` adds it to every dev request.
 */
export function isDirectLocalRequest(request: Request): boolean {
  const { headers } = request
  return (
    !headers.has('cf-access-jwt-assertion') &&
    !headers.has('cf-ray') &&
    !headers.has('x-forwarded-for') &&
    !headers.has('forwarded') &&
    LOOPBACK_HOSTNAMES.has(new URL(request.url).hostname)
  )
}

/**
 * The Worker checks the Access JWT again because a path Access does not cover would pass any
 * header through. The gate logs each refusal.
 */
export async function ownerTokenFor(request: Request): Promise<OwnerTokenOutcome> {
  // Alone in its condition, so a build drops the branch (`dev-owner-token.ts`).
  if (import.meta.env.DEV) {
    const isLocal = isDirectLocalRequest(request)
    if (isLocal) {
      return mintDevOwnerToken(
        { ownerEmail: OWNER_EMAIL, privateKey: CONVEX_JWT_PRIVATE_KEY },
        { signingKey, now: Date.now },
      )
    }
  }
  return issueOwnerToken(
    request.headers.get('cf-access-jwt-assertion'),
    {
      teamDomain: ACCESS_TEAM_DOMAIN,
      audience: ACCESS_AUD,
      ownerEmail: OWNER_EMAIL,
      privateKey: CONVEX_JWT_PRIVATE_KEY,
    },
    { verify, signingKey, now: Date.now },
  )
}
