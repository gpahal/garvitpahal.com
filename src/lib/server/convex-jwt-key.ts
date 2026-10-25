import { calculateJwkThumbprint, importJWK } from 'jose'
import { z } from 'zod'

const BASE64URL = /^[\w-]+$/

export const privateJwkSchema = z.object({
  kty: z.literal('EC'),
  crv: z.literal('P-256'),
  x: z.string().regex(BASE64URL),
  y: z.string().regex(BASE64URL),
  d: z.string().regex(BASE64URL),
})

async function thumbprintOf(x: string, y: string): Promise<string> {
  return calculateJwkThumbprint({ kty: 'EC', crv: 'P-256', x, y })
}

/**
 * `kid` is the RFC 7638 thumbprint `CONVEX_JWT_JWKS` lists the key under.
 */
export type SigningKey = { key: CryptoKey; kid: string }

const WHAT_IT_TAKES = 'It takes the private JWK that `pnpm convex-jwt-key` prints'

/**
 * Throws a message that never repeats the value. The result is always named by the thumbprint, so
 * a stale `kid` in the JWK is ignored.
 */
export async function importSigningKey(json: string): Promise<SigningKey> {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new Error(`CONVEX_JWT_PRIVATE_KEY is not JSON. ${WHAT_IT_TAKES}`)
  }
  const parsed = privateJwkSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`CONVEX_JWT_PRIVATE_KEY is not a P-256 private JWK. ${WHAT_IT_TAKES}`)
  }
  const { x, y, d } = parsed.data
  let key: CryptoKey
  try {
    key = await importJWK({ kty: 'EC', crv: 'P-256', x, y, d }, 'ES256', { extractable: false })
  } catch {
    throw new Error(`CONVEX_JWT_PRIVATE_KEY is not a usable P-256 key. ${WHAT_IT_TAKES}`)
  }
  return { key, kid: await thumbprintOf(x, y) }
}
