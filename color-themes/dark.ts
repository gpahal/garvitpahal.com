import { blueDark, redDark, slateDark, yellowDark } from '@radix-ui/colors'

import { appendRadixColor, getRadixColorsWithoutName, type Theme } from './common'

export const darkTheme = {
  bg: {
    '': slateDark.slate1,
    emphasis: {
      1: slateDark.slate2,
      2: slateDark.slate3,
      3: slateDark.slate4,
    },
  },
  fg: {
    '': 'hsl(0 0% 100%)',
    muted: 'hsl(155, 5.67%, 82.6%)',
    subtle: 'hsl(155, 5.33%, 72.2%)',
  },
  neutral: appendRadixColor(getRadixColorsWithoutName(slateDark), 'hsl(0 0% 100%)'),
  info: getRadixColorsWithoutName(blueDark, 'hsl(0 0% 100%)'),
  warn: getRadixColorsWithoutName(yellowDark, 'hsl(0 0% 0%)'),
  error: getRadixColorsWithoutName(redDark, 'hsl(0 0% 100%)'),
  link: getRadixColorsWithoutName(blueDark),
  code: {
    bg: slateDark.slate3,
  },
} satisfies Theme
