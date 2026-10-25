import { exportJWK, generateKeyPair } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isDirectLocalRequest, ownerTokenFor } from './owner-token'
import { captureLogs, loggedLines } from './test-logs'

const env = vi.hoisted(() => ({
  ACCESS_TEAM_DOMAIN: undefined as string | undefined,
  ACCESS_AUD: undefined as string | undefined,
  OWNER_EMAIL: 'owner@example.com',
  CONVEX_JWT_PRIVATE_KEY: undefined as string | undefined,
}))

vi.mock('astro:env/server', () => env)

const { privateKey } = await generateKeyPair('ES256', { extractable: true })
const privateJwk = await exportJWK(privateKey)

/**
 * The build guard in `.github/workflows/check.yml` looks for it.
 */
const DEV_MARKER = 'dev_only_unverified_owner_token'

function request(headers: Record<string, string> = {}, origin = 'http://localhost:4321'): Request {
  return new Request(`${origin}/api/x/token`, { headers })
}

function logged(): string {
  return JSON.stringify(loggedLines('log'))
}

beforeEach(() => {
  Object.assign(env, {
    ACCESS_TEAM_DOMAIN: undefined,
    ACCESS_AUD: undefined,
    CONVEX_JWT_PRIVATE_KEY: JSON.stringify(privateJwk),
  })
  captureLogs()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('ownerTokenFor', () => {
  it('mints for OWNER_EMAIL without Access only in development, and says so in the log', async () => {
    vi.stubEnv('DEV', true)
    const outcome = await ownerTokenFor(request())
    expect(outcome.status).toBe('ok')
    expect(logged()).toContain(DEV_MARKER)
    // The token itself is never logged.
    expect(logged()).not.toContain(outcome.status === 'ok' ? outcome.token : '')
  })

  it('never mints without Access in a build, where DEV is false', async () => {
    vi.stubEnv('DEV', false)
    env.ACCESS_TEAM_DOMAIN = 'team.cloudflareaccess.com'
    env.ACCESS_AUD = 'aud-tag'
    expect(await ownerTokenFor(request())).toEqual({
      status: 'sign_in_required',
      reason: 'no_access_jwt',
    })
    expect(logged()).not.toContain(DEV_MARKER)
  })

  it('never mints without Access for a request Cloudflare forwarded, even in development', async () => {
    vi.stubEnv('DEV', true)
    const outcome = await ownerTokenFor(request({ 'cf-ray': 'ray' }))
    expect(outcome.status).not.toBe('ok')
    expect(logged()).not.toContain(DEV_MARKER)
  })

  it('refuses in development without the local key', async () => {
    vi.stubEnv('DEV', true)
    env.CONVEX_JWT_PRIVATE_KEY = undefined
    expect(await ownerTokenFor(request())).toMatchObject({
      status: 'unavailable',
      cause: 'misconfigured',
    })
  })
})

describe('isDirectLocalRequest', () => {
  it.each(['http://localhost:4321', 'http://127.0.0.1:4321', 'http://[::1]:4321'])(
    'accepts a bare request to %s',
    (origin) => {
      expect(isDirectLocalRequest(request({}, origin))).toBe(true)
    },
  )

  it.each(['http://192.168.1.20:4321', 'https://localhost.example.com'])(
    'refuses a request to %s, which is not this machine',
    (origin) => {
      expect(isDirectLocalRequest(request({}, origin))).toBe(false)
    },
  )

  it.each([
    ['cf-access-jwt-assertion', 'jwt'],
    ['cf-ray', '8a1b2c3d4e5f-BOM'],
    ['x-forwarded-for', '203.0.113.7'],
    ['forwarded', 'for=203.0.113.7'],
  ])('refuses a loopback request carrying %s', (name, value) => {
    expect(isDirectLocalRequest(request({ [name]: value }))).toBe(false)
  })

  it('accepts the x-forwarded-host the dev server adds to every request', () => {
    expect(isDirectLocalRequest(request({ 'x-forwarded-host': 'localhost:4321' }))).toBe(true)
  })
})
