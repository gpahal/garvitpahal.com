const { blueDark, redDark, slateDark, yellowDark } = require('@radix-ui/colors')

const { radixColorsWithoutName, appendRadixColor } = require('./common.cjs')

module.exports = {
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
  neutral: appendRadixColor(radixColorsWithoutName(slateDark), 'hsl(0 0% 100%)'),
  info: radixColorsWithoutName(blueDark, 'hsl(0 0% 100%)'),
  warn: radixColorsWithoutName(yellowDark, 'hsl(0 0% 0%)'),
  error: radixColorsWithoutName(redDark, 'hsl(0 0% 100%)'),
  link: radixColorsWithoutName(blueDark),
  code: {
    bg: slateDark.slate3,
  },
}
