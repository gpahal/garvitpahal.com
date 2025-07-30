import {
  slate,
  slateA,
  slateDark,
  slateDarkA,
  slateDarkP3,
  slateDarkP3A,
  slateP3,
  slateP3A,
} from '@radix-ui/colors'

import { generateCSSFile } from '@gpahal/tailwindcss-color-themes'

type Color = string

type BaseColors = {
  1: Color
  2: Color
  3: Color
  4: Color
  5: Color
  6: Color
  7: Color
  8: Color
  9: Color
  10: Color
  11: Color
  12: Color
}

type BaseColorsWithVariants = BaseColors & {
  a: BaseColors
  contrast: Color
  surface: Color
  indicator: Color
  track: Color
}

type Colors = BaseColorsWithVariants & {
  p3?: BaseColorsWithVariants
}

type Theme = {
  bg: Color
  anchor: Color
  gray: Colors
}

type Template<T, S extends string, V = void> = {
  [K in keyof T as K extends number
    ? S extends `${infer F}`
      ? `${F}${K}`
      : K
    : never]: V extends void ? T[K] : V
}

type RadixColors<S extends string> = Template<BaseColors, S, string>

function toBaseColors<S extends string>(colors: RadixColors<S>): BaseColors {
  const newObj = {} as BaseColors
  for (const [k, v] of Object.entries(colors)) {
    const key = (
      k.endsWith('10') || k.endsWith('11') || k.endsWith('12')
        ? Number.parseInt(k.slice(-2), 10)
        : Number.parseInt(k.slice(-1), 10)
    ) as keyof BaseColors
    newObj[key] = v as Color
  }
  return newObj
}

export const lightTheme = {
  bg: '#ffffff',
  anchor: '#2867ed',
  gray: {
    ...toBaseColors<'slate'>(slate),
    a: toBaseColors<'slateA'>(slateA),
    contrast: '#ffffff',
    surface: '#ffffffcc',
    indicator: '#8d8d86',
    track: '#8d8d86',
    p3: {
      ...toBaseColors<'slate'>(slateP3),
      a: toBaseColors<'slateA'>(slateP3A),
      contrast: '#ffffff',
      surface: 'color(display-p3 1 1 1 / 80%)',
      indicator: 'oklch(64.1% 0.01 106.7)',
      track: 'oklch(64.1% 0.01 106.7)',
    },
  },
} satisfies Theme

export const darkTheme = {
  bg: '#111111',
  anchor: '#5ba0f9',
  gray: {
    ...toBaseColors<'slate'>(slateDark),
    a: toBaseColors<'slateA'>(slateDarkA),
    contrast: '#ffffff',
    surface: 'rgba(0, 0, 0, 0.05)',
    indicator: '#6f6d66',
    track: '#6f6d66',
    p3: {
      ...toBaseColors<'slate'>(slateDarkP3),
      a: toBaseColors<'slateA'>(slateDarkP3A),
      contrast: '#ffffff',
      surface: 'color(display-p3 0 0 0 / 0.05)',
      indicator: 'oklch(53.5% 0.011 93.67)',
      track: 'oklch(53.5% 0.011 93.67)',
    },
  },
} satisfies Theme

async function main() {
  await generateCSSFile(
    {
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
    },
    'src/styles/color-theme.css',
  )
}

await main()
