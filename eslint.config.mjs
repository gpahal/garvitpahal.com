import eslintAstroConfig from '@gpahal/eslint-config/astro'
import eslintBaseConfig from '@gpahal/eslint-config/base'

/** @type {import("@gpahal/eslint-config/base").Config} */
export default eslintBaseConfig({
  tsconfigRootDir: import.meta.dirname,
  tsconfigPaths: './tsconfig.json',
  configs: [eslintAstroConfig],
})
