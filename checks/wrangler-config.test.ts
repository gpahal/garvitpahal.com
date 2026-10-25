import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { unstable_readConfig } from 'wrangler'
import { z } from 'zod'

import astroConfig from '../astro.config'
import { WORKER_SECRETS } from '../scripts/deploy-worker'

/**
 * Deploy uses `env.deploy` while the build and dev server read the top level, so a key an
 * environment does not inherit, or restates differently, shows up as a difference.
 */

const ROOT = path.join(import.meta.dirname, '..')
const CONFIG = path.join(ROOT, 'wrangler.jsonc')

/**
 * What `pnpm dev` reads: the unverified owner token's two settings and the puzzle solvers' key.
 * The Access settings only matter behind Access.
 */
const DEV_SECRETS = ['OPENAI_API_KEY', 'CONVEX_JWT_PRIVATE_KEY', 'OWNER_EMAIL']

const runWorkerFirstSchema = z.union([z.boolean(), z.array(z.string())])

/**
 * Wrangler's own `Config` type comes from a package it bundles rather than installs, so it does not
 * resolve.
 */
const configSchema = z.looseObject({
  name: z.string().optional(),
  assets: z
    .looseObject({
      binding: z.string().optional(),
      run_worker_first: runWorkerFirstSchema.optional(),
    })
    .optional(),
  secrets: z.looseObject({ required: z.array(z.string()).optional() }).optional(),
})

type ResolvedConfig = z.infer<typeof configSchema>

function resolvedConfig(env?: string): ResolvedConfig {
  return configSchema.parse(unstable_readConfig({ config: CONFIG, env }))
}

const topLevel = resolvedConfig()
const deploy = resolvedConfig('deploy')

/**
 * `rules`, which the Vite plugin warns about at the top level, `targetEnvironment`, which Wrangler
 * sets on any config resolved for an environment, and `secrets`, since the dev server reads fewer
 * than the Worker.
 */
const DEPLOY_ONLY = ['rules', 'targetEnvironment', 'secrets'] as const

function withoutDeployOnly(config: ResolvedConfig): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...config }
  for (const key of DEPLOY_ONLY) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- `rest` is a copy
    delete rest[key]
  }
  // The adapter names the binding in its generated config; the deploy has to restate it.
  if (config.assets !== undefined) {
    const { binding: _binding, ...assets } = config.assets
    rest.assets = assets
  }
  return rest
}

describe('wrangler.jsonc', () => {
  it('resolves env.deploy to the top level plus the deploy-only keys', () => {
    expect(deploy.name).toBe('garvitpahal-com')
    expect(withoutDeployOnly(deploy)).toStrictEqual(withoutDeployOnly(topLevel))
  })

  it('requires every server secret astro.config.ts declares at deploy, and the dev ones locally', () => {
    const declared = Object.entries(astroConfig.env?.schema ?? {})
      .filter(([, field]) => field.context === 'server' && field.access === 'secret')
      .map(([name]) => name)
    expect(new Set(WORKER_SECRETS)).toStrictEqual(new Set(declared))
    expect(new Set(deploy.secrets?.required)).toStrictEqual(new Set(WORKER_SECRETS))
    expect(new Set(topLevel.secrets?.required)).toStrictEqual(new Set(DEV_SECRETS))
  })
})
