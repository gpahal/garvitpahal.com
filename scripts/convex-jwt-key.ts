/**
 * `pnpm convex-jwt-key` prints a new ES256 private JWK for `CONVEX_JWT_PRIVATE_KEY`. Convex's
 * `CONVEX_JWT_JWKS` is derived from it (`scripts/convex-env.ts`), so nothing else is printed.
 */

import { exportJWK, generateKeyPair } from 'jose'

import { privateJwkSchema } from '../src/lib/server/convex-jwt-key.ts'

const { privateKey } = await generateKeyPair('ES256', { extractable: true })
const { x, y, d } = privateJwkSchema.parse(await exportJWK(privateKey))

console.log(
  [
    "# CONVEX_JWT_PRIVATE_KEY: the JSON line below, as a secret in Infisical's dev environment for",
    '# local development or its prod environment for production, never both. It signs tokens Convex',
    '# trusts: keep it out of files and chat. `pnpm convex-dev-set-env` and Deploy set Convex from it.',
    JSON.stringify({ kty: 'EC', crv: 'P-256', x, y, d }),
  ].join('\n'),
)
