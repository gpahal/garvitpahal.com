import type { AuthConfig } from 'convex/server'

import { jwksIssue } from './lib/authRules'
import { CONVEX_JWT_AUDIENCE, CONVEX_JWT_ISSUER } from './shared/convexJwt'

const WHERE_TO_SET =
  "Set it with `pnpm convex-dev-set-env` locally, or by re-running Deploy in production, which sets it from Infisical's prod environment (docs/deployment.md, How a deploy runs)"

/**
 * Refuses to load, and so to deploy, without a setting, an empty one included.
 */
function required(name: string, why: string): string {
  const value = process.env[name]?.trim()
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set on this Convex deployment. ${why}. ${WHERE_TO_SET}`)
  }
  return value
}

/**
 * `OWNER_EMAIL` is not part of the provider, but a deploy that cannot let the owner in is better
 * stopped here.
 */
function requiredJwks(): string {
  required('OWNER_EMAIL', 'It names the only account allowed to use the private tools')
  const jwks = required(
    'CONVEX_JWT_JWKS',
    "It holds the public keys that verify the Worker's tokens",
  )
  const issue = jwksIssue(jwks)
  if (issue !== undefined) {
    throw new Error(`${issue}. ${WHERE_TO_SET}`)
  }
  return jwks
}

export default {
  providers: [
    {
      type: 'customJwt',
      issuer: CONVEX_JWT_ISSUER,
      jwks: requiredJwks(),
      algorithm: 'ES256',
      // Never omitted: without it Convex does not check the audience at all
      // (https://docs.convex.dev/auth/advanced/custom-jwt#warning-omitting-applicationid-is-often-insecure).
      applicationID: CONVEX_JWT_AUDIENCE,
    },
  ],
} satisfies AuthConfig
