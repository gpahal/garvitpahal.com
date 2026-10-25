import { configDefaults, defineConfig } from 'vitest/config'

/**
 * Not built on Astro's config, whose loading would boot the Cloudflare adapter in both test
 * projects.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'pure',
          // West of UTC, to catch a local getter where a UTC one belongs.
          env: { TZ: 'America/Los_Angeles' },
          // Agent worktrees under `.claude/` hold whole checkouts.
          include: ['**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, 'convex/*.test.ts', '.claude/**', '.scratch/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'handlers',
          environment: 'edge-runtime',
          env: { OWNER_EMAIL: 'owner@example.com' },
          include: ['convex/*.test.ts'],
        },
      },
    ],
  },
})
