/**
 * Kept apart from `auth.config.ts` so tests can run it without loading the config. It imports
 * nothing, as `scripts/convex-env.ts` runs it under Node type stripping beside deploy credentials.
 */

/**
 * Convex's documented form for an inline `jwks`.
 */
export const JWKS_DATA_URI_PREFIX = 'data:text/plain;charset=utf-8;base64,'

export function jwksDataUri(jwks: unknown): string {
  return `${JWKS_DATA_URI_PREFIX}${btoa(JSON.stringify(jwks))}`
}

/**
 * Throws where the rest is not base64 JSON.
 */
function jwksOfDataUri(value: string): unknown {
  return JSON.parse(atob(value.slice(JWKS_DATA_URI_PREFIX.length)))
}

const HOW_TO_MAKE_ONE =
  "It is derived from the Worker's CONVEX_JWT_PRIVATE_KEY: set it with `pnpm convex-dev-set-env` locally, or by re-running Deploy in production, never by hand"

/**
 * Convex would otherwise accept a malformed value and reject every token. A key with `d` is a
 * private key in the wrong place, refused before it is stored as trusted config.
 */
export function jwksIssue(value: string): string | undefined {
  if (!value.startsWith(JWKS_DATA_URI_PREFIX)) {
    return `CONVEX_JWT_JWKS must start with ${JWKS_DATA_URI_PREFIX}. ${HOW_TO_MAKE_ONE}`
  }
  let parsed: unknown
  try {
    parsed = jwksOfDataUri(value)
  } catch {
    return `CONVEX_JWT_JWKS does not hold base64 JSON. ${HOW_TO_MAKE_ONE}`
  }
  const keys: unknown =
    typeof parsed === 'object' && parsed !== null && 'keys' in parsed ? parsed.keys : undefined
  if (!Array.isArray(keys) || keys.length === 0) {
    return `CONVEX_JWT_JWKS lists no keys. ${HOW_TO_MAKE_ONE}`
  }
  for (const key of keys as Array<unknown>) {
    if (typeof key !== 'object' || key === null) {
      return `CONVEX_JWT_JWKS lists something that is not a key. ${HOW_TO_MAKE_ONE}`
    }
    if ('d' in key) {
      return `CONVEX_JWT_JWKS holds a private key, so treat that key as leaked and rotate it (docs/deployment.md, Rotating the Convex token key). ${HOW_TO_MAKE_ONE}`
    }
    if (!('kty' in key && key.kty === 'EC' && 'crv' in key && key.crv === 'P-256')) {
      return `CONVEX_JWT_JWKS lists a key that is not a P-256 public key. ${HOW_TO_MAKE_ONE}`
    }
  }
  return undefined
}
