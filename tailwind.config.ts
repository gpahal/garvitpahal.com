import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

import tailwindcssColorThemes from '@gpahal/tailwindcss-color-themes'
import tailwindcssVariants from '@gpahal/tailwindcss-variants'

import { darkTheme, lightTheme } from './tailwind/color-theme'

const config: Config = {
  content: ['./src/**/*.{astro,js,ts,jsx,tsx,mdx}'],
  theme: {
    fontFamily: {
      sans: ['Satoshi', ...fontFamily.sans],
      mono: fontFamily.mono,
    },
    colors: {
      transparent: 'transparent',
      inherit: 'inherit',
      current: 'currentColor',
    },
  },
  plugins: [
    tailwindcssVariants,
    tailwindcssColorThemes({
      default: lightTheme,
      defaultDark: darkTheme,
      selections: [
        {
          selector: '.light-theme',
          theme: lightTheme,
        },
        {
          selector: '.dark-theme',
          theme: darkTheme,
        },
      ],
    }),
  ],
}

export default config
