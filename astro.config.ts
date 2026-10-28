import { glob, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import type { AstroIntegration, AstroUserConfig } from 'astro'
import { defineConfig, envField } from 'astro/config'

import cloudflare from '@astrojs/cloudflare'
import { satteri } from '@astrojs/markdown-satteri'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import expressiveCode from 'astro-expressive-code'
import { defineHastPlugin } from 'satteri'

import { PROSE_CLASSES, TABLE_SCROLL_REGION } from './src/components/shared/prose-classes'
import {
  connectSourcesOf,
  contentSecurityPolicy,
  headersWithPolicy,
  inlineScripts,
  scriptHashSource,
} from './src/lib/server/content-security-policy'
import { isUnlistedPath } from './src/lib/site'

/**
 * Hash built pages and write their shared CSP into `_headers`; dev serves no policy.
 */
function contentSecurityPolicyHeader(): AstroIntegration {
  let convexUrl: string | undefined
  return {
    name: 'content-security-policy-header',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'read-public-convex-url',
                // The value Vite resolved, so the policy allows the deployment the pages call.
                configResolved: (config) => {
                  const url: unknown = config.env.PUBLIC_CONVEX_URL
                  convexUrl = typeof url === 'string' && url !== '' ? url : convexUrl
                },
              },
            ],
          },
        })
      },
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir)
        const builtPages = glob('**/*.html', { cwd: root })
        const reads: Array<Promise<string>> = []
        for await (const page of builtPages) {
          reads.push(readFile(`${root}/${page}`, 'utf8'))
        }
        const sources = await Promise.all(reads)
        const scripts = new Set(sources.flatMap((source) => inlineScripts(source)))
        // Only a warning: Verify production fails when the served policy lacks the socket.
        if (convexUrl === undefined) {
          logger.warn(
            "PUBLIC_CONVEX_URL is unset, so the Content-Security-Policy allows no Convex deployment and blocks Agenda's socket. In GitHub Actions, set it as a repository variable to the production deployment URL",
          )
        }
        const policy = contentSecurityPolicy({
          scriptHashSources: await Promise.all([...scripts].map(scriptHashSource)),
          connectSources: convexUrl === undefined ? [] : connectSourcesOf(convexUrl),
        })
        const headersPath = `${root}/_headers`
        await writeFile(headersPath, headersWithPolicy(await readFile(headersPath, 'utf8'), policy))
        logger.info(`Allowed ${scripts.size} inline scripts in _headers.`)
      },
    },
  }
}

/**
 * In Astro's default `cacheDir`, which only `dev` uses (`separateViteCaches`).
 */
const VITE_OPTIMIZER_OUTPUT_DIR = '/node_modules/.vite/'

type VitePlugin = NonNullable<NonNullable<AstroUserConfig['vite']>['plugins']>[number]

function withoutStaleVersion(url: string): string {
  const queryIndex = url.indexOf('?')
  if (queryIndex === -1) {
    return url
  }
  const path = url.slice(0, queryIndex)
  if (!path.includes('/node_modules/') || path.includes(VITE_OPTIMIZER_OUTPUT_DIR)) {
    return url
  }
  const query = url
    .slice(queryIndex + 1)
    .split('&')
    .filter((param) => !param.startsWith('v='))
    .join('&')
  return query ? `${path}?${query}` : path
}

/**
 * Astro stamps `renderer-url` with the prerender environment's optimiser hash and Vite serves `?v=`
 * URLs `immutable`, so the browser pins a stale React and islands render empty. Closest upstream:
 * https://github.com/withastro/astro/issues/17364. Remove once islands survive a dev restart after
 * a dependency change without it.
 */
function serveDepSourcesFresh(): VitePlugin {
  return {
    name: 'serve-dep-sources-fresh',
    apply: 'serve',
    // Not a returned post-hook: Vite adds its transform middleware after these hooks run, so this
    // must claim its place first.
    configureServer: (server) => {
      server.middlewares.use((req, _res, next) => {
        if (req.url !== undefined) {
          req.url = withoutStaleVersion(req.url)
        }
        next()
      })
    },
  }
}

/**
 * `astro sync` and `astro build` run optimisers that would rewrite a running dev server's cache and
 * empty its islands. Vite advises against sharing `cacheDir` (https://github.com/vitejs/vite/pull/12625).
 * Remove only if Vite scopes the optimiser's cache per process.
 */
function separateViteCaches(): AstroIntegration {
  return {
    name: 'separate-vite-caches',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        if (command !== 'dev') {
          updateConfig({ vite: { cacheDir: `node_modules/.vite-astro-${command}` } })
        }
      },
    },
  }
}

/**
 * Fontshare's font list lets only its own origin read the response, so the dev server proxies it.
 */
const FONTSHARE_FONTS_PATH = '/__font-tester/fontshare-fonts'

/**
 * Under `astro dev` alone, mounted by a page script since a build bundles every `client:only`
 * island. A page without an island never loads React Refresh's preamble, so the script imports it.
 */
function fontTesterInDev(): AstroIntegration {
  return {
    name: 'font-tester-in-dev',
    hooks: {
      'astro:config:setup': ({ command, injectScript, updateConfig }) => {
        if (command !== 'dev') {
          return
        }

        updateConfig({
          vite: {
            server: {
              proxy: {
                [FONTSHARE_FONTS_PATH]: {
                  target: 'https://api.fontshare.com',
                  changeOrigin: true,
                  rewrite: () => '/v2/fonts?limit=1000',
                  // A same-origin fetch carries every localhost cookie, whatever the port, and a
                  // Referer; neither is Fontshare's to see.
                  configure: (proxy) => {
                    proxy.on('proxyReq', (proxyReq) => {
                      proxyReq.removeHeader('cookie')
                      proxyReq.removeHeader('referer')
                    })
                  },
                },
              },
            },
          },
        })
        injectScript(
          'page',
          [
            "import '@vitejs/plugin-react/preamble'",
            "import { mountFontTester } from '/src/components/shared/font-tester-mount.tsx'",
            `mountFontTester(${JSON.stringify(FONTSHARE_FONTS_PATH)})`,
          ].join('\n'),
        )
      },
    },
  }
}

/**
 * `false` is Astro's default, localhost.
 */
const LOCAL_DEV_HOSTS: ReadonlySet<string | boolean> = new Set([
  false,
  'localhost',
  '127.0.0.1',
  '::1',
])

/**
 * Refuses `astro dev --host`: the dev server signs a loopback request in as the owner
 * (`isDirectLocalRequest`), and a LAN client can name `localhost` in its Host header.
 */
function refuseExposedDevServer(): AstroIntegration {
  return {
    name: 'refuse-exposed-dev-server',
    hooks: {
      'astro:config:setup': ({ command, config }) => {
        if (command === 'dev' && !LOCAL_DEV_HOSTS.has(config.server.host)) {
          throw new Error(
            'The dev server signs every request in as the owner, so it listens only on this machine. Run pnpm dev without --host',
          )
        }
      },
    },
  }
}

/**
 * Without it, `constrained` derives `sizes` from the source width, so a wide screenshot downloads
 * at full size. Matches `max-w-xl px-6` on `main` in `src/layouts/layout.astro`; change them
 * together.
 */
const PROSE_IMAGE_SIZES = '(min-width: 36rem) 33rem, calc(100vw - 3rem)'

/**
 * Nodes are read-only snapshots, where an assignment is silently dropped.
 */
const proseImageSizes = defineHastPlugin({
  name: 'prose-image-sizes',
  element: {
    filter: ['img'],
    visit(node, ctx) {
      if (node.properties.sizes == null) {
        ctx.setProperty(node, 'sizes', PROSE_IMAGE_SIZES)
      }
    },
  },
})

function isProseTag(tag: string): tag is keyof typeof PROSE_CLASSES {
  return Object.hasOwn(PROSE_CLASSES, tag)
}

/**
 * Styles rendered Markdown, which has no components to style it. The `<code>` in a `pre` is
 * Expressive Code's.
 */
const proseClasses = defineHastPlugin({
  name: 'prose-classes',
  element: {
    filter: Object.keys(PROSE_CLASSES),
    visit(node, ctx) {
      const parent = ctx.parent(node)
      if (
        !isProseTag(node.tagName) ||
        (node.tagName === 'code' && parent.type === 'element' && parent.tagName === 'pre')
      ) {
        return
      }
      const existing = Array.isArray(node.properties.className) ? node.properties.className : []
      ctx.setProperty(node, 'className', [...existing, ...PROSE_CLASSES[node.tagName].split(' ')])
      if (node.tagName === 'table') {
        ctx.wrapNode(node, {
          type: 'element',
          tagName: 'div',
          properties: {
            ...TABLE_SCROLL_REGION,
            className: TABLE_SCROLL_REGION.className.split(' '),
          },
          children: [],
        })
      }
    },
  },
})

export default defineConfig({
  site: 'https://garvitpahal.com',
  // Change with `html_handling` in `wrangler.jsonc`.
  trailingSlash: 'never',
  adapter: cloudflare({
    // Sharp never ships to workerd.
    imageService: 'compile',
    prerenderEnvironment: 'node',
  }),
  image: {
    layout: 'constrained',
  },
  markdown: {
    processor: satteri({
      hastPlugins: [proseImageSizes, proseClasses],
      features: { smartPunctuation: { quotes: false } },
    }),
  },
  // Otherwise the Cloudflare adapter enables them on a `SESSION` KV binding the Worker lacks.
  session: false,
  // Defence in depth beside the `/api/x` gate's fetch-metadata check, pinned so a framework default
  // cannot remove it silently.
  security: { checkOrigin: true },
  env: {
    schema: {
      // Optional for prerendering; the puzzle route checks it per request.
      OPENAI_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      // Optional for prerendering; `pnpm dev` needs only `OWNER_EMAIL` and `CONVEX_JWT_PRIVATE_KEY`.
      ACCESS_TEAM_DOMAIN: envField.string({ context: 'server', access: 'secret', optional: true }),
      ACCESS_AUD: envField.string({ context: 'server', access: 'secret', optional: true }),
      OWNER_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
      CONVEX_JWT_PRIVATE_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      PUBLIC_CONVEX_URL: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
        url: true,
      }),
    },
  },
  integrations: [
    sitemap({ filter: (page) => !isUnlistedPath(new URL(page).pathname) }),
    expressiveCode(),
    react(),
    contentSecurityPolicyHeader(),
    fontTesterInDev(),
    refuseExposedDevServer(),
    separateViteCaches(),
  ],
  vite: {
    plugins: [tailwindcss(), serveDepSourcesFresh()],
    // No `optimizeDeps.include`: this config is shared by every Vite environment, so adding
    // `@astrojs/react/client.js` makes the prerender one bundle its own React into `renderer-url`.
    // Use `optimizeDeps.entries` for a scan hint.

    // The puzzle Worker is a module Worker, as the dev server serves it.
    worker: { format: 'es' },
    server: {
      // Vite's default CORS lets a page on any localhost port read what the dev server serves, such
      // as the `.dev.vars` with the secrets that a build under `infisical run` leaves in
      // `dist/server`.
      cors: false,
    },
  },
})
