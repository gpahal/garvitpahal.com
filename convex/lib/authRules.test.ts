import { describe, expect, it } from 'vitest'

import { jwksDataUri, jwksIssue } from './authRules'

/**
 * A generated P-256 public key.
 */
const PUBLIC_KEY = {
  kty: 'EC',
  crv: 'P-256',
  x: 'AuDC408yFWzLPhS7TVyNPKu_oCDlDWaYO-yi4WX-5Fo',
  y: '1Kv6vgyyKgtwDUwInlQOSoLEiZJhTzsMnkZTs3aXUgc',
  kid: 'k1',
  alg: 'ES256',
  use: 'sig',
}

describe('jwksIssue', () => {
  it('accepts a data URI listing a P-256 public key', () => {
    expect(jwksIssue(jwksDataUri({ keys: [PUBLIC_KEY] }))).toBeUndefined()
  })

  it.each([
    ['bare JSON', JSON.stringify({ keys: [PUBLIC_KEY] }), 'must start with'],
    ['another curve', jwksDataUri({ keys: [{ ...PUBLIC_KEY, crv: 'P-384' }] }), 'P-256 public key'],
    ['a private key', jwksDataUri({ keys: [{ ...PUBLIC_KEY, d: 'dd' }] }), 'holds a private key'],
  ])('refuses %s', (_label, value, wording) => {
    expect(jwksIssue(value)).toContain(wording)
  })
})
