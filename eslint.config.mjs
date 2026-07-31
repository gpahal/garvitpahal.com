import eslintAstroConfig from '@gpahal/eslint-config/astro'
import eslintBaseConfig from '@gpahal/eslint-config/base'
import eslintCssConfig from '@gpahal/eslint-config/css'
import eslintReactConfig from '@gpahal/eslint-config/react'
import eslintTailwindcssConfig from '@gpahal/eslint-config/tailwindcss'

/** @type {import("@gpahal/eslint-config/base").Config} */
export default eslintBaseConfig({
  tsconfigRootDir: import.meta.dirname,
  configs: [
    eslintAstroConfig,
    eslintReactConfig,
    eslintCssConfig,
    eslintTailwindcssConfig({
      entryPoint: 'src/styles/global.css',
      tsconfig: './tsconfig.json',
      detectComponentClasses: true,
    }),
  ],
})
