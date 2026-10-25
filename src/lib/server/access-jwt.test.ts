import { errors, exportJWK, generateKeyPair, SignJWT } from 'jose'
import type { JWTPayload } from 'jose'
import { describe, expect, it, vi } from 'vitest'

import { createAccessJwtVerifier } from './access-jwt'

const TEAM = 'team.cloudflareaccess.com'
const AUD = 'aud-tag'
const EXPECTED = { teamDomain: TEAM, audience: AUD }
const CERTS_URL = `https://${TEAM}/cdn-cgi/access/certs`
const NOW = Date.UTC(2026, 0, 1)
const SECONDS = NOW / 1000

async function rsaKey(kid: string) {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true })
  return {
    privateKey,
    kid,
    jwk: { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' },
  }
}

type AccessKey = Awaited<ReturnType<typeof rsaKey>>

const current = await rsaKey('current')
const other = await rsaKey('other')

const CLAIMS: JWTPayload = {
  iss: `https://${TEAM}`,
  aud: [AUD],
  email: 'owner@example.com',
  sub: 'user-id',
  type: 'app',
  iat: SECONDS - 10,
  nbf: SECONDS - 10,
  exp: SECONDS + 600,
}

async function accessJwt(
  claims: JWTPayload = CLAIMS,
  { key = current }: { key?: AccessKey } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: key.kid, typ: 'JWT' })
    .sign(key.privateKey)
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

/**
 * Only a verifier that trusted the header could accept it.
 */
function unsignedJwt(header: Record<string, unknown>): string {
  return `${encode(header)}.${encode(CLAIMS)}.${encode('signature')}`
}

function setup({ certs = { keys: [current.jwk] } }: { certs?: unknown } = {}) {
  const fetchFn = vi.fn(async (url: string) => {
    expect(url).toBe(CERTS_URL)
    return certs instanceof Error
      ? Promise.reject(certs)
      : Promise.resolve(Response.json(certs, { status: certs === 'down' ? 502 : 200 }))
  })
  const verify = createAccessJwtVerifier({
    fetchFn: fetchFn as unknown as typeof fetch,
    now: () => NOW,
  })
  return { verify: async (token: string) => verify(token, EXPECTED), fetchFn }
}

describe('createAccessJwtVerifier', () => {
  it("accepts Access's token and reads its email", async () => {
    const { verify } = setup()
    expect(await verify(await accessJwt())).toEqual({
      status: 'valid',
      email: 'owner@example.com',
    })
  })

  it.each([
    ['another issuer', { iss: 'https://other.cloudflareaccess.com' }, 'claim_iss'],
    ['an issuer with a trailing slash', { iss: `https://${TEAM}/` }, 'claim_iss'],
    ["another application's audience", { aud: ['other-aud'] }, 'claim_aud'],
    ['an expiry past the leeway', { exp: SECONDS - 61 }, 'expired'],
    ['a start after the leeway', { nbf: SECONDS + 61 }, 'claim_nbf'],
    // A service token carries no email.
    ['no email', { email: undefined }, 'malformed_claims'],
    ['an empty email', { email: ' ' }, 'malformed_claims'],
    ['no expiry', { exp: undefined }, 'claim_exp'],
    ['no start', { nbf: undefined }, 'claim_nbf'],
    ['no issue time', { iat: undefined }, 'claim_iat'],
  ])('refuses a token with %s', async (_label, change, reason) => {
    const { verify } = setup()
    expect(await verify(await accessJwt({ ...CLAIMS, ...change }))).toEqual({
      status: 'invalid',
      reason,
    })
  })

  it('allows a minute of clock skew either way', async () => {
    const { verify } = setup()
    const skewed = { ...CLAIMS, exp: SECONDS - 59, nbf: SECONDS + 59, iat: SECONDS + 59 }
    expect(await verify(await accessJwt(skewed))).toMatchObject({ status: 'valid' })
  })

  it('refuses claims changed after signing and a key the certs do not list under its kid', async () => {
    const { verify } = setup()
    const [header = '', , signature = ''] = (await accessJwt()).split('.', 3)
    const tampered = `${header}.${encode({ ...CLAIMS, email: 'someone@example.com' })}.${signature}`
    const otherKey = await accessJwt(CLAIMS, { key: { ...other, kid: 'current' } })
    for (const forged of [tampered, otherKey]) {
      expect(await verify(forged)).toEqual({
        status: 'invalid',
        reason: errors.JWSSignatureVerificationFailed.code,
      })
    }
  })

  it('refuses a kid the certs do not list', async () => {
    const { verify } = setup()
    expect(await verify(await accessJwt(CLAIMS, { key: other }))).toEqual({
      status: 'invalid',
      reason: errors.JWKSNoMatchingKey.code,
    })
  })

  it.each(['none', 'HS256', 'RS384'])(
    'refuses a header naming %s before fetching the certs',
    async (alg) => {
      const { verify, fetchFn } = setup()
      expect(await verify(unsignedJwt({ alg, kid: 'current', typ: 'JWT' }))).toEqual({
        status: 'invalid',
        reason: errors.JOSEAlgNotAllowed.code,
      })
      expect(fetchFn).not.toHaveBeenCalled()
    },
  )

  it('refuses malformed input', async () => {
    const { verify } = setup()
    expect(await verify('!!!.???.***')).toEqual({
      status: 'invalid',
      reason: errors.JWSInvalid.code,
    })
  })

  it.each([
    ['unreachable', new TypeError('fetch failed')],
    ['answering with an error', 'down'],
  ])('reports the certs %s as unavailable, never as valid', async (_label, certs) => {
    const { verify } = setup({ certs })
    expect(await verify(await accessJwt())).toMatchObject({ status: 'unavailable' })
  })
})
