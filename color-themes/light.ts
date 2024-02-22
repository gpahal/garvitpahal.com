import { blue, red, slate, yellow } from '@radix-ui/colors'

import { getRadixColorsWithoutName, type Theme } from './common'

export const lightTheme = {
  bg: {
    '': 'hsl(0 0% 100%)',
    emphasis: {
      1: slate.slate1,
      2: slate.slate2,
      3: slate.slate3,
    },
  },
  fg: {
    '': slate.slate12,
    muted: 'hsl(155, 17%, 20.33%)',
    subtle: slate.slate11,
  },
  neutral: getRadixColorsWithoutName(slate),
  info: getRadixColorsWithoutName(blue, 'hsl(0 0% 100%)'),
  warn: getRadixColorsWithoutName(yellow, 'hsl(0 0% 0%)'),
  error: getRadixColorsWithoutName(red, 'hsl(0 0% 100%)'),
  link: getRadixColorsWithoutName(blue),
  code: {
    bg: slate.slate2,
  },
} satisfies Theme
