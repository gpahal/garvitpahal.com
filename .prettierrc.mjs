import { defineConfig } from '@gpahal/prettier-config'

export default defineConfig({
  root: import.meta.dirname,
  astro: true,
  tailwindcss: { entryPoint: 'src/styles/global.css' },
  sortImports: {
    // `@convex/` is the backend's path alias, not a package scope, so it gets a group of its own
    // before the `@/` aliases rather than sorting among the packages.
    importOrder: (defaults) =>
      defaults.toSpliced(defaults.indexOf('^@/public/(.*)$'), 0, '^@convex/(.*)$', ''),
  },
})
