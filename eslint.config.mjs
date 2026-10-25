import { defineConfig, files } from '@gpahal/eslint-config'

/**
 * Every extension Vite bundles and Convex deploys, so a fence that lists fewer leaves a way past
 * it.
 */
const SCRIPT_EXTENSIONS = '{js,jsx,mjs,cjs,ts,tsx,mts,cts}'

const ROUTE_EXTENSIONS = '{js,mjs,ts,mts}'

const SOURCES = [`src/**/*.${SCRIPT_EXTENSIONS}`, 'src/**/*.astro']

const TESTS = `src/**/*.test.${SCRIPT_EXTENSIONS}`

const CONVEX_SOURCES = `convex/**/*.${SCRIPT_EXTENSIONS}`

const TEST_HELPERS = `src/**/test-*.${SCRIPT_EXTENSIONS}`

const PAGES_ZONE = {
  target: './src',
  from: './src/pages',
  message: 'Nothing imports from `src/pages`: a route is an entry point',
}

/**
 * Fences folders rather than modules, so a new server file is covered. Without the trailing glob
 * the pattern matches no file inside a `server/` folder.
 */
const SERVER_DIR_ZONE = {
  target: './src',
  from: './src/**/server/**',
  message:
    'A `server/` folder never reaches the browser: only `src/pages/api/`, `src/middleware.ts`, another `server/` folder and tests import it, or `scripts/` and `astro.config.ts`, which are not bundled',
}

const SERVER_DIR_READERS = [
  `src/pages/api/**/*.${ROUTE_EXTENSIONS}`,
  `src/middleware.${SCRIPT_EXTENSIONS}`,
  `src/**/server/**/*.${SCRIPT_EXTENSIONS}`,
  TESTS,
]

const PUZZLES_ROOT = 'src/lib/x/puzzle-solvers'

/**
 * The puzzles' Worker halves, which anywhere but the Worker entry and the registry would put image
 * and solver code in the page chunk. Matched by module name, since a sibling imports `./compute`.
 */
const COMPUTE_HALVES_PATTERN = {
  regex: String.raw`(^|/)compute(-registry)?(\.[cm]?[jt]s)?$`,
  allowTypeImports: true,
  message:
    'Only `processing/worker.ts` and `compute-registry.ts` import the Worker halves at runtime; elsewhere use `import type`',
}

const COMPUTE_READERS = [
  `${PUZZLES_ROOT}/processing/worker.ts`,
  `${PUZZLES_ROOT}/puzzles/compute-registry.ts`,
  TESTS,
]

const OWNER_BUILDERS_MESSAGE =
  'Use `ownerQuery`, `ownerMutation` or `internalMutation` from `convex/lib/functionBuilders.ts` to preserve authorisation and triggers'

/**
 * Bans `importNames` from the generated server module and every generic builder in
 * `convex/server`. Blind to a dynamic `import()`.
 *
 * @param {Array<string>} importNames The generated builders a module may not import
 */
function builderFence(importNames) {
  return [
    {
      group: ['**/_generated/server', '**/_generated/server.js'],
      importNames,
      message: OWNER_BUILDERS_MESSAGE,
    },
    {
      group: ['convex/server'],
      importNames: [
        'queryGeneric',
        'mutationGeneric',
        'internalMutationGeneric',
        'actionGeneric',
        'httpActionGeneric',
      ],
      message: OWNER_BUILDERS_MESSAGE,
    },
  ]
}

export default defineConfig({
  root: import.meta.dirname,
  astro: true,
  react: true,
  tailwindcss: {
    entryPoint: 'src/styles/global.css',
    settings: { tsconfig: './tsconfig.json', detectComponentClasses: true },
  },
  testFiles: (defaults) => [...defaults, TEST_HELPERS],
  vitest: true,
  antislop: true,
  // Every `src/lib` module outside a `server/` folder is browser-safe, except the build-time
  // helpers.
  browser: {
    files: [
      'src/components/**',
      'src/hooks/**',
      'src/lib/**',
      '!src/lib/**/server/**',
      '!src/lib/blog.ts',
      '!src/lib/dates.ts',
      `!**/*.test.${SCRIPT_EXTENSIONS}`,
    ],
  },
  server: {
    files: [
      'src/pages/api/**',
      'src/middleware.ts',
      'src/**/server/**',
      'convex/**',
      'scripts/**',
      'checks/**',
    ],
  },
  configs: [
    // Tests stand partial fakes in for framework objects.
    {
      files: [...files.test, TEST_HELPERS],
      rules: {
        'slop/no-chained-type-assertions': 'off',
      },
    },
    // Nesting in configuration and schemas is shape rather than logic.
    {
      files: [`**/*.config.${SCRIPT_EXTENSIONS}`, 'convex/schema.ts'],
      rules: {
        'unicorn/max-nested-calls': 'off',
      },
    },
    // Nothing imports a route: it would carry along the `server/` modules an API route may import.
    {
      files: SOURCES,
      ignores: SERVER_DIR_READERS,
      rules: {
        'import-x/no-restricted-paths': ['error', { zones: [PAGES_ZONE, SERVER_DIR_ZONE] }],
      },
    },
    {
      files: SERVER_DIR_READERS,
      rules: {
        'import-x/no-restricted-paths': ['error', { zones: [PAGES_ZONE] }],
      },
    },
    {
      files: SOURCES,
      ignores: COMPUTE_READERS,
      rules: {
        'no-restricted-imports': ['error', { patterns: [COMPUTE_HALVES_PATTERN] }],
      },
    },
    // Convex module names become function paths, which can't contain `-`.
    {
      files: [CONVEX_SOURCES],
      rules: {
        'unicorn/filename-case': ['error', { case: 'camelCase' }],
      },
    },
    // A raw internal mutation would write without the aggregate's triggers.
    {
      files: [CONVEX_SOURCES],
      ignores: ['convex/lib/functionBuilders.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: builderFence([
              'query',
              'mutation',
              'internalMutation',
              'action',
              'httpAction',
            ]),
          },
        ],
      },
    },
    // The wrapper takes what it wraps, but never an action builder, which would skip the owner
    // check.
    {
      files: ['convex/lib/functionBuilders.ts'],
      rules: {
        'no-restricted-imports': ['error', { patterns: builderFence(['action', 'httpAction']) }],
      },
    },
  ],
}).override('gpahal/react/refresh', (config) => {
  // `styled` in `shared/typography.tsx` makes a component, as `memo` does.
  const [severity, options] = config.rules['react-refresh/only-export-components']
  return {
    ...config,
    rules: {
      ...config.rules,
      'react-refresh/only-export-components': [severity, { ...options, extraHOCs: ['styled'] }],
    },
  }
})
