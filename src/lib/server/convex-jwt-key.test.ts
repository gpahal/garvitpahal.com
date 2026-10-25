import { calculateJwkThumbprint, exportJWK, generateKeyPair } from 'jose'
import { describe, expect, it } from 'vitest'

import { importSigningKey } from './convex-jwt-key'

async function privateJwkOf() {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true })
  const jwk = await exportJWK(privateKey)
  return { ...jwk, kid: await calculateJwkThumbprint(jwk) }
}

const privateJwk = await privateJwkOf()
const { d: _d, ...publicJwk } = privateJwk

describe('importSigningKey', () => {
  it('imports a sign-only key under its thumbprint, whatever kid the JWK carries', async () => {
    const { kid, key } = await importSigningKey(JSON.stringify({ ...privateJwk, kid: 'stale' }))
    expect(kid).toBe(privateJwk.kid)
    expect(key.usages).toEqual(['sign'])
    expect(key.extractable).toBe(false)
  })

  it.each([
    ['text that is not JSON', 'not json', 'not JSON'],
    ['the public half', JSON.stringify(publicJwk), 'not a P-256 private JWK'],
  ])('refuses %s, without repeating the secret', async (_label, json, wording) => {
    const refusal = importSigningKey(json)
    await expect(refusal).rejects.toThrow(wording)
    await expect(refusal).rejects.not.toThrow(privateJwk.d)
  })
})
