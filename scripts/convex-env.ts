/**
 * Sets a Convex deployment's `OWNER_EMAIL` and `CONVEX_JWT_JWKS` from the Worker's `OWNER_EMAIL`
 * and `CONVEX_JWT_PRIVATE_KEY`, so the two sides cannot disagree, and passes `NTFY_URL` and
 * `NTFY_TOKEN` through from Infisical. `pnpm convex-dev-set-env` runs it
 * with Infisical's `dev` environment against `.env.development`'s deployment, refusing a deploy key;
 * Deploy calls `setConvexEnv` with `prod`. It imports only Node's built-ins and a module that
 * imports nothing, as `scripts/deploy-worker.ts` must.
 */

import { execFileSync } from 'node:child_process'
import { createHash, createPrivateKey, createPublicKey } from 'node:crypto'
import type { JsonWebKey, KeyObject } from 'node:crypto'

import { jwksDataUri } from '../convex/lib/authRules.ts'

const WHAT_IT_TAKES = 'It takes the private JWK that `pnpm convex-jwt-key` prints'

/**
 * The JWK's own members, with any other dropped.
 */
function jwkOf(value: unknown): JsonWebKey | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const members: JsonWebKey = {}
  for (const name of ['kty', 'crv', 'x', 'y', 'd'] as const) {
    const member: unknown = Reflect.get(value, name)
    if (typeof member !== 'string') {
      return undefined
    }
    members[name] = member
  }
  return members
}

function privateKeyOf(json: string): KeyObject {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error(`CONVEX_JWT_PRIVATE_KEY is not JSON. ${WHAT_IT_TAKES}`)
  }
  const jwk = jwkOf(parsed)
  if (jwk === undefined) {
    throw new Error(`CONVEX_JWT_PRIVATE_KEY is not a private JWK. ${WHAT_IT_TAKES}`)
  }
  let key: KeyObject
  try {
    // Also refuses a `d` that does not belong to the JWK's `x` and `y`.
    key = createPrivateKey({ key: jwk, format: 'jwk' })
  } catch {
    throw new Error(`CONVEX_JWT_PRIVATE_KEY is not a usable key. ${WHAT_IT_TAKES}`)
  }
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error(`CONVEX_JWT_PRIVATE_KEY is not a P-256 key. ${WHAT_IT_TAKES}`)
  }
  return key
}

/**
 * The public half under its RFC 7638 thumbprint, the `kid` the Worker signs with
 * (`src/lib/server/convex-jwt-key.ts`).
 */
function jwksOfPrivateKey(json: string): string {
  const { kty, crv, x, y } = createPublicKey(privateKeyOf(json)).export({ format: 'jwk' })
  // RFC 7638: the required members in lexicographic order, without whitespace.
  const kid = createHash('sha256').update(JSON.stringify({ crv, kty, x, y })).digest('base64url')
  return jwksDataUri({ keys: [{ kty, crv, x, y, kid, alg: 'ES256', use: 'sig' }] })
}

type ConvexEnvSource = {
  ownerEmail: string | undefined
  privateKey: string | undefined
  ntfyUrl: string | undefined
  ntfyToken: string | undefined
}

/**
 * The server's base URL, which takes JSON posts at its root (`convex/lib/ntfy.ts`).
 */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * The dotenv `convex env set --force` reads on stdin. Single quotes keep a value literal, so one
 * holding a quote or line break is refused rather than escaped.
 */
function convexEnvFile(source: ConvexEnvSource): string {
  const values = {
    OWNER_EMAIL: source.ownerEmail?.trim() ?? '',
    CONVEX_JWT_PRIVATE_KEY: source.privateKey?.trim() ?? '',
    NTFY_URL: source.ntfyUrl?.trim() ?? '',
    NTFY_TOKEN: source.ntfyToken?.trim() ?? '',
  }
  const unset = Object.entries(values)
    .filter(([, value]) => value === '')
    .map(([name]) => name)
  if (unset.length > 0) {
    throw new Error(`Unset: ${unset.join(', ')}`)
  }
  for (const name of ['OWNER_EMAIL', 'NTFY_URL', 'NTFY_TOKEN'] as const) {
    if (/['\r\n]/.test(values[name])) {
      throw new Error(`${name} holds a quote or line break`)
    }
  }
  if (!isHttpsUrl(values.NTFY_URL)) {
    throw new Error('NTFY_URL is not an https URL')
  }
  return [
    `OWNER_EMAIL='${values.OWNER_EMAIL}'`,
    `CONVEX_JWT_JWKS='${jwksOfPrivateKey(values.CONVEX_JWT_PRIVATE_KEY)}'`,
    `NTFY_URL='${values.NTFY_URL}'`,
    `NTFY_TOKEN='${values.NTFY_TOKEN}'`,
    '',
  ].join('\n')
}

function convexEnvSet(file: string): void {
  execFileSync('pnpm', ['exec', 'convex', 'env', 'set', '--force'], {
    input: file,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
}

/**
 * Targets the deployment `CONVEX_DEPLOY_KEY` names, or else the one `CONVEX_DEPLOYMENT` selects,
 * which `pnpm convex-dev-set-env` loads from `.env.development` and Node's `--env-file` lets the
 * environment override. The values go over stdin, never into an argument list.
 */
export function setConvexEnv(source: ConvexEnvSource): void {
  convexEnvSet(convexEnvFile(source))
}

function runLocally(): void {
  // `convex env set` would follow the key, so a production key would overwrite production's values.
  // The CLI also reads `CONVEX_DEPLOYMENT_TOKEN` as an alias.
  const deployKey = ['CONVEX_DEPLOY_KEY', 'CONVEX_DEPLOYMENT_TOKEN'].find(
    (name) => (process.env[name] ?? '') !== '',
  )
  if (deployKey !== undefined) {
    console.error(
      `${deployKey} is set, so this would change the deployment it names rather than your dev deployment. Unset it, or remove it from Infisical's dev environment, then run \`pnpm convex-dev-set-env\` again`,
    )
    process.exitCode = 1
    return
  }
  let file: string
  try {
    file = convexEnvFile({
      ownerEmail: process.env.OWNER_EMAIL,
      privateKey: process.env.CONVEX_JWT_PRIVATE_KEY,
      ntfyUrl: process.env.NTFY_URL,
      ntfyToken: process.env.NTFY_TOKEN,
    })
  } catch (error) {
    console.error(
      `${error instanceof Error ? error.message : String(error)}. Set OWNER_EMAIL, CONVEX_JWT_PRIVATE_KEY, NTFY_URL and NTFY_TOKEN in Infisical's dev environment and run this as \`pnpm convex-dev-set-env\` (README, Running the private tools)`,
    )
    process.exitCode = 1
    return
  }
  convexEnvSet(file)
}

// Only when run, so `deploy-worker.ts` can import the module.
if (import.meta.main) {
  runLocally()
}
