import { addPrettierAstroConfig } from '@gpahal/prettier-config/astro'
import baseConfig from '@gpahal/prettier-config/base'
import { addPrettierTailwindConfig } from '@gpahal/prettier-config/tailwindcss'

/** @type {import("@gpahal/prettier-config/base").Config} */
const config = addPrettierAstroConfig(
  addPrettierTailwindConfig(baseConfig, './src/styles/global.css'),
)

export default config
