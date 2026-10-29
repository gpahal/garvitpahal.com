import { afterEach, expect, test, vi } from 'vitest'

import { jwksDataUri } from './lib/authRules'
import { CONVEX_JWT_AUDIENCE, CONVEX_JWT_ISSUER } from './shared/convexJwt'

/**
 * A generated P-256 public key.
 */
const KEY = {
  kty: 'EC',
  crv: 'P-256',
  x: 'AuDC408yFWzLPhS7TVyNPKu_oCDlDWaYO-yi4WX-5Fo',
  y: '1Kv6vgyyKgtwDUwInlQOSoLEiZJhTzsMnkZTs3aXUgc',
  kid: 'k1',
}

function jwks(key: Record<string, string>): string {
  return jwksDataUri({ keys: [key] })
}

async function loadConfig(env: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value)
  }
  vi.resetModules()
  return (await import('./auth.config')).default
}

afterEach(() => {
  vi.unstubAllEnvs()
})

test('accepts only ES256 tokens from its issuer for its audience', async () => {
  const config = await loadConfig({ OWNER_EMAIL: 'owner@example.com', CONVEX_JWT_JWKS: jwks(KEY) })
  expect(config.providers).toEqual([
    {
      type: 'customJwt',
      issuer: CONVEX_JWT_ISSUER,
      jwks: jwks(KEY),
      algorithm: 'ES256',
      applicationID: CONVEX_JWT_AUDIENCE,
    },
  ])
})

test('refuses to load without an owner', async () => {
  await expect(loadConfig({ OWNER_EMAIL: undefined, CONVEX_JWT_JWKS: jwks(KEY) })).rejects.toThrow(
    'OWNER_EMAIL is not set',
  )
})
