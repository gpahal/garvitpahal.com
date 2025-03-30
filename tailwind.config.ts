import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

import tailwindcssVariants from '@gpahal/tailwindcss-variants'

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
    // tailwindcssColorThemes({
    //   default: lightTheme,
    //   defaultDark: darkTheme,
    //   selections: [
    //     {
    //       selector: '.light-theme',
    //       theme: lightTheme,
    //     },
    //     {
    //       selector: '.dark-theme',
    //       theme: darkTheme,
    //     },
    //   ],
    // }),
  ],
}

export default config
