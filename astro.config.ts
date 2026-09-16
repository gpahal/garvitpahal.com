import type { AstroIntegration } from 'astro'
import { defineConfig, envField } from 'astro/config'

import cloudflare from '@astrojs/cloudflare'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import expressiveCode from 'astro-expressive-code'

const PERSONAL_API_ROUTE_PREFIX = '/api/x'

function isPersonalRoutePattern(pattern: string): boolean {
  return (
    pattern === PERSONAL_API_ROUTE_PREFIX || pattern.startsWith(`${PERSONAL_API_ROUTE_PREFIX}/`)
  )
}

/**
 * `/x` is gated by Cloudflare Access at the edge, so prerendered pages under it are still protected.
 * API routes are different: they must run on demand to reach the API key. This guards against
 * one silently being prerendered into an asset instead.
 *
 * Note: avoid bare utility-like words in comments here. Tailwind's content detection scans this
 * file, and a stray token ends up as a real rule in the CSS bundle.
 */
function assertApiRoutesAreOnDemand(): AstroIntegration {
  return {
    name: 'assert-api-routes-are-on-demand',
    hooks: {
      'astro:routes:resolved': ({ routes }) => {
        const leaked = routes.filter(
          (route) => route.isPrerendered && isPersonalRoutePattern(route.pattern),
        )
        if (leaked.length > 0) {
          throw new Error(
            `Protected API routes must be rendered on demand. Add \`export const prerender = false\` to: ${leaked
              .map((route) => route.entrypoint)
              .join(', ')}`,
          )
        }
      },
    },
  }
}

export default defineConfig({
  site: 'https://garvitpahal.com',
  adapter: cloudflare({
    // 'compile' optimizes at build time and serves `/_image` through the passthrough endpoint at
    // runtime, so sharp never ships in the worker. `hasUserImageService` still filters the sharp
    // entrypoint by name, but with `prerenderEnvironment: 'node'` the adapter falls back to real
    // sharp in Node (adapter >= 14.2) - output is byte-identical to 'custom'. Do not drop the Node
    // prerender: in workerd the fallback is the workerd encoder, ~47% larger files.
    imageService: 'compile',
    prerenderEnvironment: 'node',
  }),
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
  session: false,
  env: {
    schema: {
      // Optional so builds succeed without secrets present - `astro:env/server` throws at module
      // scope for missing required secrets, and middleware is evaluated while prerendering.
      OPENAI_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  integrations: [
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/x') }),
    expressiveCode(),
    mdx(),
    react(),
    assertApiRoutesAreOnDemand(),
  ],
  vite: {
    plugins: [tailwindcss()],
    // One React: a second module instance leaves hooks reading the other copy's dispatcher, which
    // surfaces as "Invalid hook call" and a null `useState`.
    //
    // No `optimizeDeps.include` on purpose - Astro's scanner already pre-bundles what islands
    // import. Never add `@astrojs/react/client.js`: this config is shared by every Vite
    // environment, so the prerender one bundles its own React and Astro puts that copy in
    // `renderer-url`. Use `optimizeDeps.entries` if a scan hint is ever needed.
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
  },
})
