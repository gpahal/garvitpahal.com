const { blue, red, slate, yellow } = require('@radix-ui/colors')

const { radixColorsWithoutName } = require('./common.cjs')

module.exports = {
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
  neutral: radixColorsWithoutName(slate),
  info: radixColorsWithoutName(blue, 'hsl(0 0% 100%)'),
  warn: radixColorsWithoutName(yellow, 'hsl(0 0% 0%)'),
  error: radixColorsWithoutName(red, 'hsl(0 0% 100%)'),
  link: radixColorsWithoutName(blue),
  code: {
    bg: slate.slate2,
  },
}
