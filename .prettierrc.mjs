import baseConfig from '@gpahal/prettier-config/base'
import { addPrettierTailwindConfig } from '@gpahal/prettier-config/tailwindcss'

/** @type {import("@gpahal/prettier-config/base").PrettierBaseConfig & import("@gpahal/prettier-config/tailwindcss").PrettierTailwindConfig} */
const config = addPrettierTailwindConfig(baseConfig, './tailwind.config.ts')

export default config
