/**
 * The secrets half of [Deploy](../.github/workflows/deploy.yml): it fetches the Worker's secrets
 * from Infisical's `prod` environment, sets Convex's settings from them and uploads them with the
 * Worker. It runs beside the deploy credentials from an install without scripts, so it imports
 * only Node's built-ins and modules that do the same, and checks responses by shape without zod.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { setConvexEnv } from './convex-env.ts'

/**
 * The server secrets `astro.config.ts` declares, and exactly the names Infisical's `prod`
 * environment holds at `/`.
 */
export const WORKER_SECRETS = [
  'OPENAI_API_KEY',
  'CONVEX_JWT_PRIVATE_KEY',
  'ACCESS_TEAM_DOMAIN',
  'ACCESS_AUD',
  'OWNER_EMAIL',
] as const

type WorkerSecrets = Record<(typeof WORKER_SECRETS)[number], string>

const INFISICAL_URL = 'https://app.infisical.com'
const INFISICAL_ENVIRONMENT = 'prod'

/**
 * The `aud` GitHub mints the deploy's token for, which the Infisical identity must list
 * (docs/deployment.md, Infisical). Not GitHub's default, the owner's URL, so the token is good for
 * Infisical alone.
 */
const OIDC_AUDIENCE = INFISICAL_URL

type InfisicalSettings = {
  /**
   * `ACTIONS_ID_TOKEN_REQUEST_URL` and `_TOKEN`, which `id-token: write` gives the job.
   */
  idTokenUrl: string
  idTokenRequestToken: string
  identityId: string
  projectId: string
}

/**
 * Infisical's error bodies carry a `message`; nothing in them repeats a secret.
 */
async function responseJson(response: Response, what: string): Promise<unknown> {
  const body: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'message' in body ? String(body.message) : ''
    throw new Error(`${what} answered ${response.status}${message === '' ? '' : `: ${message}`}`)
  }
  return body
}

function stringField(body: unknown, field: string, what: string): string {
  const value: unknown =
    typeof body === 'object' && body !== null ? Reflect.get(body, field) : undefined
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${what} returned no ${field}`)
  }
  return value
}

/**
 * Signs in as the OIDC machine identity with GitHub's token for this job, then lists `/` in `prod`
 * without imports, so every value is set where Deploy reads it.
 */
async function fetchInfisicalSecrets(settings: InfisicalSettings): Promise<unknown> {
  const idTokenUrl = new URL(settings.idTokenUrl)
  idTokenUrl.searchParams.set('audience', OIDC_AUDIENCE)
  const idToken = stringField(
    await responseJson(
      await fetch(idTokenUrl, {
        headers: { Authorization: `Bearer ${settings.idTokenRequestToken}` },
      }),
      "GitHub's OIDC token endpoint",
    ),
    'value',
    "GitHub's OIDC token endpoint",
  )

  const accessToken = stringField(
    await responseJson(
      await fetch(`${INFISICAL_URL}/api/v1/auth/oidc-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ identityId: settings.identityId, jwt: idToken }),
      }),
      "Infisical's OIDC login",
    ),
    'accessToken',
    "Infisical's OIDC login",
  )

  const secretsUrl = new URL(`${INFISICAL_URL}/api/v3/secrets/raw`)
  secretsUrl.search = new URLSearchParams({
    workspaceId: settings.projectId,
    environment: INFISICAL_ENVIRONMENT,
    secretPath: '/',
    include_imports: 'false',
    recursive: 'false',
    expandSecretReferences: 'true',
  }).toString()
  return responseJson(
    await fetch(secretsUrl, { headers: { Authorization: `Bearer ${accessToken}` } }),
    "Infisical's secrets list",
  )
}

/**
 * Refuses anything but exactly `WORKER_SECRETS`, each non-empty: an extra name is most likely a
 * misspelt one, and the upload never deletes a Worker secret. Issues name secrets, never values.
 */
function workerSecretsOf(body: unknown): { secrets: WorkerSecrets } | { issues: Array<string> } {
  const listed: unknown =
    typeof body === 'object' && body !== null && 'secrets' in body ? body.secrets : undefined
  if (!Array.isArray(listed)) {
    return { issues: ["Infisical's secrets list holds no secrets array"] }
  }
  const values = new Map<string, string>()
  const issues: Array<string> = []
  for (const entry of listed as Array<unknown>) {
    const key: unknown =
      typeof entry === 'object' && entry !== null && 'secretKey' in entry
        ? entry.secretKey
        : undefined
    const value: unknown =
      typeof entry === 'object' && entry !== null && 'secretValue' in entry
        ? entry.secretValue
        : undefined
    if (typeof key !== 'string' || typeof value !== 'string') {
      return { issues: ["Infisical's secrets list holds an entry without a name and value"] }
    }
    if (values.has(key)) {
      issues.push(`${key} is listed twice`)
    }
    values.set(key, value.trim())
  }
  const expected = new Set<string>(WORKER_SECRETS)
  for (const name of WORKER_SECRETS) {
    const value = values.get(name)
    if (value === undefined) {
      issues.push(`${name} is missing`)
    } else if (value === '') {
      issues.push(`${name} is empty`)
    }
  }
  for (const name of values.keys()) {
    if (!expected.has(name)) {
      issues.push(`${name} is not a Worker secret`)
    }
  }
  if (issues.length > 0) {
    return { issues }
  }
  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- every name was checked above
    secrets: Object.fromEntries(
      WORKER_SECRETS.map((name) => [name, values.get(name) ?? '']),
    ) as WorkerSecrets,
  }
}

/**
 * `RUNNER_TEMP` is emptied after every job, and the deploy step deletes the file sooner.
 */
function secretsFilePath(): string {
  const { RUNNER_TEMP: runnerTemp } = process.env
  if (runnerTemp === undefined || runnerTemp === '') {
    throw new Error('RUNNER_TEMP is unset: run this in GitHub Actions')
  }
  return path.join(runnerTemp, 'worker-secrets.json')
}

function requiredEnv(name: string, where: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new Error(`${name} is unset. ${where}`)
  }
  return value
}

async function fetchSecrets(): Promise<void> {
  const settings: InfisicalSettings = {
    idTokenUrl: requiredEnv(
      'ACTIONS_ID_TOKEN_REQUEST_URL',
      'Give the deploy job the `id-token: write` permission',
    ),
    idTokenRequestToken: requiredEnv(
      'ACTIONS_ID_TOKEN_REQUEST_TOKEN',
      'Give the deploy job the `id-token: write` permission',
    ),
    identityId: requiredEnv(
      'INFISICAL_IDENTITY_ID',
      'Set it as a repository variable to the Infisical machine identity ID (docs/deployment.md, GitHub)',
    ),
    projectId: requiredEnv(
      'INFISICAL_PROJECT_ID',
      'Set it as a repository variable to the project ID in .infisical.yaml (docs/deployment.md, GitHub)',
    ),
  }
  const result = workerSecretsOf(await fetchInfisicalSecrets(settings))
  if ('issues' in result) {
    for (const issue of result.issues) {
      console.log(
        `::error::Infisical's prod environment: ${issue}. It must hold exactly ${WORKER_SECRETS.join(', ')} at /, each set; see docs/deployment.md, Infisical.`,
      )
    }
    process.exitCode = 1
    return
  }
  for (const value of Object.values(result.secrets)) {
    for (const line of value.split(/\r?\n/)) {
      if (line !== '') {
        console.log(`::add-mask::${line}`)
      }
    }
  }
  writeFileSync(secretsFilePath(), JSON.stringify(result.secrets), { mode: 0o600, flag: 'wx' })
}

function readSecretsFile(): WorkerSecrets {
  const parsed: unknown = JSON.parse(readFileSync(secretsFilePath(), 'utf8'))
  const entries: Array<[string, unknown]> =
    typeof parsed === 'object' && parsed !== null ? Object.entries(parsed) : []
  const result = workerSecretsOf({
    secrets: entries.map(([secretKey, secretValue]) => ({ secretKey, secretValue })),
  })
  if ('issues' in result) {
    throw new Error(`The fetched secrets file is invalid: ${result.issues.join('; ')}`)
  }
  return result.secrets
}

function convexEnv(): void {
  const secrets = readSecretsFile()
  setConvexEnv({ ownerEmail: secrets.OWNER_EMAIL, privateKey: secrets.CONVEX_JWT_PRIVATE_KEY })
}

function deploy(): void {
  const { DEPLOY_TAG: tag, WORKER_MESSAGE: message } = process.env
  if (tag === undefined || tag === '' || message === undefined || message === '') {
    throw new Error('Set DEPLOY_TAG and WORKER_MESSAGE to label the Worker version')
  }
  const secretsFile = secretsFilePath()
  readSecretsFile()
  try {
    // `env.deploy` names neither the entry nor the assets, and its module rules assume no bundling.
    // `--secrets-file` adds and updates secrets but never deletes one.
    execFileSync(
      'pnpm',
      [
        'exec',
        'wrangler',
        'deploy',
        'dist/server/entry.mjs',
        '--config',
        'wrangler.jsonc',
        '--env',
        'deploy',
        '--no-bundle',
        '--assets',
        'dist/client',
        '--secrets-file',
        secretsFile,
        '--tag',
        tag,
        '--message',
        message,
      ],
      { stdio: 'inherit' },
    )
  } finally {
    rmSync(secretsFile, { force: true })
  }
}

// Only when run, so `checks/wrangler-config.test.ts` can import `WORKER_SECRETS`.
if (import.meta.main) {
  const commands: Record<string, () => void | Promise<void>> = {
    'fetch-secrets': fetchSecrets,
    'convex-env': convexEnv,
    deploy,
  }
  const [name = ''] = process.argv.slice(2)
  const command = commands[name]
  if (command === undefined) {
    console.error('Usage: node scripts/deploy-worker.ts fetch-secrets|convex-env|deploy')
    process.exitCode = 1
  } else {
    try {
      await command()
    } catch (error) {
      console.log(`::error::${error instanceof Error ? error.message : String(error)}`)
      process.exitCode = 1
    }
  }
}
