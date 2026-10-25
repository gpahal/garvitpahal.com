import { createRemoteJWKSet, customFetch, errors, jwtVerify } from 'jose'
import type { JWTVerifyGetKey, JWTVerifyResult } from 'jose'
import { z } from 'zod'

import { errorText } from '@/lib/server/log'

/**
 * Between Cloudflare's clock and the Worker's.
 */
const CLOCK_SKEW_SECONDS = 60

/**
 * Access lists the previous key for a week after rotating, so an hour's reuse misses nothing. The
 * cooldown stops a forged `kid` making every request refetch. A failed fetch is not cached, so
 * each request retries and fails closed.
 */
const JWKS_OPTIONS = {
  cacheMaxAge: 60 * 60 * 1000,
  cooldownDuration: 60 * 1000,
  timeoutDuration: 5000,
} as const

/**
 * The claim jose leaves to the caller. A service token carries no `email`, so it is refused.
 */
const claimsSchema = z.object({ email: z.string().trim().min(1) })

/**
 * jose errors that mean the token itself is bad. Any other failure, such as a certs timeout, means
 * nothing could be verified.
 */
const INVALID_CODES = new Set<string>([
  errors.JWSSignatureVerificationFailed.code,
  errors.JWKSNoMatchingKey.code,
  errors.JWKSMultipleMatchingKeys.code,
  errors.JWSInvalid.code,
  errors.JWTInvalid.code,
  errors.JOSEAlgNotAllowed.code,
  errors.JOSENotSupported.code,
])

export type AccessJwtVerdict =
  | { status: 'valid'; email: string }
  /**
   * `reason` is for the log: to the caller every one of these means signing in again. Only
   * `expired` is routine.
   */
  | { status: 'invalid'; reason: string }
  | { status: 'unavailable'; message: string }

export type AccessJwtVerifier = (
  token: string,
  expected: { teamDomain: string; audience: string },
) => Promise<AccessJwtVerdict>

function invalidReason(error: unknown): string | undefined {
  if (error instanceof errors.JWTExpired) {
    return 'expired'
  }
  if (error instanceof errors.JWTClaimValidationFailed) {
    return `claim_${error.claim}`
  }
  return error instanceof errors.JOSEError && INVALID_CODES.has(error.code) ? error.code : undefined
}

/**
 * Verifies as Cloudflare says to
 * (https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/),
 * RS256 alone whatever a key or token claims. Keep one per isolate. On Workers, a request awaiting
 * I/O another request started can hang if that one is cancelled, so nothing here may cache a
 * pending promise across requests.
 */
export function createAccessJwtVerifier({
  fetchFn,
  now,
}: {
  fetchFn: typeof fetch
  now: () => number
}): AccessJwtVerifier {
  let keySet: { certsUrl: string; getKey: JWTVerifyGetKey } | undefined

  function keySetFor(certsUrl: string): JWTVerifyGetKey {
    if (keySet?.certsUrl !== certsUrl) {
      const getKey = createRemoteJWKSet(new URL(certsUrl), {
        ...JWKS_OPTIONS,
        [customFetch]: fetchFn,
      })
      keySet = { certsUrl, getKey }
    }
    return keySet.getKey
  }

  return async (token, { teamDomain, audience }) => {
    const issuer = `https://${teamDomain}`
    let verified: JWTVerifyResult
    try {
      verified = await jwtVerify(token, keySetFor(`${issuer}/cdn-cgi/access/certs`), {
        issuer,
        audience,
        algorithms: ['RS256'],
        clockTolerance: CLOCK_SKEW_SECONDS,
        requiredClaims: ['exp', 'nbf', 'iat'],
        currentDate: new Date(now()),
      })
    } catch (error) {
      const reason = invalidReason(error)
      return reason === undefined
        ? { status: 'unavailable', message: errorText(error) }
        : { status: 'invalid', reason }
    }
    const claims = claimsSchema.safeParse(verified.payload)
    if (!claims.success) {
      return { status: 'invalid', reason: 'malformed_claims' }
    }
    return { status: 'valid', email: claims.data.email }
  }
}
