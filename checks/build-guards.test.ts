import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { AstroIntegration } from 'astro'

import { afterAll, describe, expect, it } from 'vitest'

import { RESPONSE_HEADERS } from '@/lib/server/api-gate'
import { scriptHashSource } from '@/lib/server/content-security-policy'

import astroConfig from '../astro.config'
import { WORKER_CSP } from '../scripts/verify-access'

/**
 * Runs the CSP and exposed-dev-server guards through the Astro configuration, since testing the
 * helpers alone would miss one removed from it, and keeps Verify production's copy of the gate's
 * policy in step.
 */

function integrationNamed(name: string): AstroIntegration {
  const found = astroConfig.integrations?.find(
    (integration): integration is AstroIntegration =>
      typeof integration === 'object' &&
      integration !== null &&
      'name' in integration &&
      integration.name === name,
  )
  expect(found, `astro.config.ts lists no \`${name}\` integration`).toBeDefined()
  return found!
}

const CONVEX_URL = 'https://example.convex.cloud'

const INLINE_SCRIPT = 'console.log("hydrate")'

const outputRoots: Array<string> = []

afterAll(async () => {
  await Promise.all(outputRoots.map(async (root) => rm(root, { recursive: true, force: true })))
})

async function buildOutput(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'csp-guard-'))
  outputRoots.push(root)
  const shipped = await readFile(new URL('../public/_headers', import.meta.url), 'utf8')
  await writeFile(path.join(root, '_headers'), shipped)
  await writeFile(
    path.join(root, 'index.html'),
    `<!doctype html><html><head><script src="/_astro/page.js"></script></head>` +
      `<body><script>${INLINE_SCRIPT}</script></body></html>`,
  )
  return root
}

async function runPolicyIntegration(root: string): Promise<string> {
  // The parts of Astro's hook signatures each integration touches; the casts are the price of calling
  // a hook outside a build.
  type VitePluginLike = {
    name: string
    configResolved: (config: { env: Record<string, unknown> }) => void
  }
  type BuildDoneHook = (options: {
    dir: URL
    logger: { info: (message: string) => void; warn: (message: string) => void }
  }) => Promise<void>
  type ConfigSetupHook = (options: {
    updateConfig: (config: { vite: { plugins: Array<VitePluginLike> } }) => void
  }) => void
  const integration = integrationNamed('content-security-policy-header')
  const plugins: Array<VitePluginLike> = []
  const setup = integration.hooks['astro:config:setup'] as unknown as ConfigSetupHook
  setup({
    updateConfig: (config) => {
      plugins.push(...config.vite.plugins)
    },
  })
  const reader = plugins.find((plugin) => plugin.name === 'read-public-convex-url')
  expect(reader, 'the integration registers no plugin to read PUBLIC_CONVEX_URL').toBeDefined()
  reader?.configResolved({ env: { PUBLIC_CONVEX_URL: CONVEX_URL } })

  const done = integration.hooks['astro:build:done'] as unknown as BuildDoneHook
  await done({
    dir: pathToFileURL(`${root}${path.sep}`),
    logger: { info: () => undefined, warn: () => undefined },
  })
  return readFile(path.join(root, '_headers'), 'utf8')
}

describe('the Content-Security-Policy integration', () => {
  it('is wired into astro.config.ts and writes the policy into the built _headers', async () => {
    const written = await runPolicyIntegration(await buildOutput())

    expect(written).toMatch(/^ {2}Content-Security-Policy: /m)

    expect(written.match(/^\/\*$/gm)).toHaveLength(1)

    // A glob or regex change would break this silently.
    expect(written).toContain(await scriptHashSource(INLINE_SCRIPT))

    // Reading a `src` as inline means an inline one somewhere may be going unhashed.
    expect(written).not.toContain(await scriptHashSource(''))

    expect(written).toContain(`connect-src 'self' ${CONVEX_URL} wss://example.convex.cloud`)
    expect(written).toContain("worker-src 'self'")
  })
})

describe('Verify production', () => {
  it("tells the Worker's 401 from Access's by the policy the gate sends", () => {
    expect(WORKER_CSP).toBe(RESPONSE_HEADERS['content-security-policy'])
  })
})

describe('the exposed dev server refusal', () => {
  it('is wired into astro.config.ts and lets the dev server listen on this machine alone', () => {
    type DevHostHook = (options: {
      command: 'dev' | 'build' | 'preview'
      config: { server: { host: string | boolean } }
    }) => void
    const setup = integrationNamed('refuse-exposed-dev-server').hooks[
      'astro:config:setup'
    ] as unknown as DevHostHook
    const start =
      (host: string | boolean, command: 'dev' | 'build' = 'dev') =>
      () => {
        setup({ command, config: { server: { host } } })
      }
    // `--host` alone arrives as `true`; with an address, as that address.
    for (const host of [true, '0.0.0.0']) {
      expect(start(host), String(host)).toThrow(/listens only on this machine/)
    }
    for (const host of [false, 'localhost', '::1']) {
      expect(start(host), String(host)).not.toThrow()
    }
    // A build signs no one in, so its host is not this guard's business.
    expect(start(true, 'build')).not.toThrow()
  })
})
