import { calculateJwkThumbprint, exportJWK, generateKeyPair, jwtVerify } from 'jose'
import { describe, expect, it, vi } from 'vitest'

import { CONVEX_JWT_AUDIENCE, CONVEX_JWT_ISSUER } from '@convex/shared/convexJwt'

import type { AccessJwtVerdict } from './access-jwt'
import { importSigningKey } from './convex-jwt-key'
import { createSigningKeyCache, issueOwnerToken, mintConvexToken } from './convex-token'
import type { OwnerTokenOutcome, OwnerTokenSettings } from './convex-token'

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0, 500)

const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
const PRIVATE_KEY = JSON.stringify(await exportJWK(privateKey))
const KID = await calculateJwkThumbprint(await exportJWK(publicKey))

/**
 * Verifies as `convex/auth.config.ts` has Convex do it, throwing for a token Convex would refuse.
 */
async function readVerified(token: string): Promise<{ header: unknown; claims: unknown }> {
  const { protectedHeader, payload } = await jwtVerify(token, publicKey, {
    algorithms: ['ES256'],
    issuer: CONVEX_JWT_ISSUER,
    audience: CONVEX_JWT_AUDIENCE,
    currentDate: new Date(NOW),
  })
  return { header: protectedHeader, claims: payload }
}

describe('mintConvexToken', () => {
  it('mints a five-minute ES256 token for the issuer and audience Convex requires', async () => {
    const token = await mintConvexToken(await importSigningKey(PRIVATE_KEY), 'o@example.com', NOW)
    const iat = Math.floor(NOW / 1000)
    expect(await readVerified(token)).toEqual({
      header: { alg: 'ES256', typ: 'JWT', kid: KID },
      claims: {
        iss: CONVEX_JWT_ISSUER,
        aud: CONVEX_JWT_AUDIENCE,
        sub: 'o@example.com',
        email: 'o@example.com',
        iat,
        exp: iat + 300,
      },
    })
  })
})

const SETTINGS: OwnerTokenSettings = {
  teamDomain: 'team.cloudflareaccess.com',
  audience: 'aud-tag',
  ownerEmail: 'owner@example.com',
  privateKey: PRIVATE_KEY,
}

function setup(verdict?: AccessJwtVerdict) {
  const verify = vi.fn(
    async (): Promise<AccessJwtVerdict> =>
      verdict ?? { status: 'valid', email: 'Owner@example.com' },
  )
  const issue = async (assertion: string | null, settings: Partial<OwnerTokenSettings> = {}) =>
    issueOwnerToken(
      assertion,
      { ...SETTINGS, ...settings },
      { verify, signingKey: createSigningKeyCache(), now: () => NOW },
    )
  return { verify, issue }
}

describe('issueOwnerToken', () => {
  it("mints a token for the owner once Access's token is verified", async () => {
    const { verify, issue } = setup()
    const outcome = await issue('access-jwt')
    expect(verify).toHaveBeenCalledWith('access-jwt', {
      teamDomain: 'team.cloudflareaccess.com',
      audience: 'aud-tag',
    })
    expect(outcome.status).toBe('ok')
    const { claims } = await readVerified(outcome.status === 'ok' ? outcome.token : '')
    expect(claims).toMatchObject({ email: 'Owner@example.com' })
  })

  it('refuses without verifying when a secret is unset or bad, or there is no Access token', async () => {
    const { verify, issue } = setup()
    // Settings come first, whatever the request carries.
    expect(await issue(null, { teamDomain: undefined, privateKey: ' ' })).toEqual({
      status: 'unavailable',
      cause: 'misconfigured',
      message: 'Unset Worker secrets: ACCESS_TEAM_DOMAIN, CONVEX_JWT_PRIVATE_KEY',
    })
    expect(await issue('access-jwt', { privateKey: '{"kty":"oct"}' })).toMatchObject({
      status: 'unavailable',
      cause: 'misconfigured',
    })
    expect(await issue(null)).toEqual({ status: 'sign_in_required', reason: 'no_access_jwt' })
    expect(verify).not.toHaveBeenCalled()
  })

  it.each<[string, AccessJwtVerdict, OwnerTokenOutcome]>([
    [
      'a token that fails verification',
      { status: 'invalid', reason: 'expired' },
      { status: 'sign_in_required', reason: 'expired' },
    ],
    [
      "Access's keys out of reach",
      { status: 'unavailable', message: 'fetch failed' },
      { status: 'unavailable', cause: 'outage', message: 'fetch failed' },
    ],
    [
      'an account that is not the owner',
      { status: 'valid', email: 'someone@example.com' },
      { status: 'forbidden' },
    ],
  ])('answers %s without minting', async (_label, verdict, outcome) => {
    const { issue } = setup(verdict)
    expect(await issue('access-jwt')).toEqual(outcome)
  })
})
