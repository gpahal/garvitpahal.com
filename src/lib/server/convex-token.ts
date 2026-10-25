import { SignJWT } from 'jose'

import { CONVEX_JWT_AUDIENCE, CONVEX_JWT_ISSUER } from '@convex/shared/convexJwt'
import { isOwnerEmail } from '@convex/shared/ownerEmail'

import type { AccessJwtVerifier } from '@/lib/server/access-jwt'
import { importSigningKey } from '@/lib/server/convex-jwt-key'
import type { SigningKey } from '@/lib/server/convex-jwt-key'
import { errorText } from '@/lib/server/log'

/**
 * Long enough for the client to refresh well before expiry, short enough that a token taken from
 * the page is soon worthless. It opens only Convex, where the owner check still applies.
 */
const CONVEX_TOKEN_LIFETIME_SECONDS = 300

/**
 * A token `convex/auth.config.ts` accepts. `sub` is the email rather than Access's user id, so the
 * local development path, which has no Access, mints the same identity.
 */
export async function mintConvexToken(
  { key, kid }: SigningKey,
  email: string,
  nowMs: number,
): Promise<string> {
  const iat = Math.floor(nowMs / 1000)
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid })
    .setIssuer(CONVEX_JWT_ISSUER)
    .setAudience(CONVEX_JWT_AUDIENCE)
    .setSubject(email)
    .setIssuedAt(iat)
    .setExpirationTime(iat + CONVEX_TOKEN_LIFETIME_SECONDS)
    .sign(key)
}

export type OwnerTokenOutcome =
  | { status: 'ok'; token: string }
  | { status: 'sign_in_required'; reason: string }
  | { status: 'forbidden' }
  /**
   * `misconfigured` is a missing or invalid Worker setting; `outage` is unreachable Access certs.
   * `message` is for the log only.
   */
  | { status: 'unavailable'; cause: 'misconfigured' | 'outage'; message: string }

export type OwnerTokenSettings = {
  teamDomain: string | undefined
  audience: string | undefined
  ownerEmail: string | undefined
  privateKey: string | undefined
}

export function misconfigured(message: string): OwnerTokenOutcome {
  return { status: 'unavailable', cause: 'misconfigured', message }
}

export type SigningKeyCache = (json: string) => Promise<SigningKey | OwnerTokenOutcome>

/**
 * Imports the key once per isolate, since changing a secret starts new isolates. Caches the settled
 * result, a failed import included, not the pending import (see `createAccessJwtVerifier`).
 */
export function createSigningKeyCache(): SigningKeyCache {
  let cached: SigningKey | OwnerTokenOutcome | undefined
  return async (json) => {
    cached ??= await importSigningKey(json).catch((error: unknown) =>
      misconfigured(errorText(error)),
    )
    return cached
  }
}

export function isUnset(value: string | undefined): value is '' | undefined {
  return value === undefined || value === ''
}

/**
 * Mints a Convex token for the owner's verified Access JWT. Settings are checked first, so a
 * misconfigured Worker says so whatever the request carries.
 */
export async function issueOwnerToken(
  assertion: string | null,
  settings: OwnerTokenSettings,
  deps: { verify: AccessJwtVerifier; signingKey: SigningKeyCache; now: () => number },
): Promise<OwnerTokenOutcome> {
  // Host names are case-insensitive, but jose compares `iss` exactly, and Access issues it in
  // lower case.
  const teamDomain = settings.teamDomain?.trim().toLowerCase()
  const audience = settings.audience?.trim()
  const ownerEmail = settings.ownerEmail?.trim()
  const privateKey = settings.privateKey?.trim()
  if (isUnset(teamDomain) || isUnset(audience) || isUnset(ownerEmail) || isUnset(privateKey)) {
    const unset = Object.entries({
      ACCESS_TEAM_DOMAIN: teamDomain,
      ACCESS_AUD: audience,
      OWNER_EMAIL: ownerEmail,
      CONVEX_JWT_PRIVATE_KEY: privateKey,
    })
      .filter(([, value]) => isUnset(value))
      .map(([name]) => name)
    return misconfigured(`Unset Worker secrets: ${unset.join(', ')}`)
  }
  const key = await deps.signingKey(privateKey)
  if ('status' in key) {
    return key
  }

  if (assertion === null || assertion === '') {
    return { status: 'sign_in_required', reason: 'no_access_jwt' }
  }
  const verdict = await deps.verify(assertion, { teamDomain, audience })
  if (verdict.status === 'unavailable') {
    return { status: 'unavailable', cause: 'outage', message: verdict.message }
  }
  if (verdict.status === 'invalid') {
    return { status: 'sign_in_required', reason: verdict.reason }
  }
  return isOwnerEmail(verdict.email, ownerEmail)
    ? { status: 'ok', token: await mintConvexToken(key, verdict.email, deps.now()) }
    : { status: 'forbidden' }
}
