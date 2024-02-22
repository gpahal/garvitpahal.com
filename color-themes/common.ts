export type RadixColors = Record<string, string>

export type RadixColorsWithoutName = {
  fg?: string
} & Record<number, string>

export type Theme = {
  bg: {
    '': string
    emphasis: {
      1: string
      2: string
      3: string
    }
  }
  fg: {
    '': string
    muted: string
    subtle: string
  }
  neutral: RadixColorsWithoutName
  info: RadixColorsWithoutName
  warn: RadixColorsWithoutName
  error: RadixColorsWithoutName
  link: RadixColorsWithoutName
  code: {
    bg: string
  }
}

export function getRadixColorsWithoutName(colors: RadixColors, fg?: string): RadixColorsWithoutName {
  const newObj: RadixColorsWithoutName = { fg }
  Object.entries(colors).forEach(([k, v]) => {
    if (k.endsWith('10') || k.endsWith('11') || k.endsWith('12')) {
      newObj[parseInt(k.slice(-2), 10)] = v
    } else {
      newObj[parseInt(k.slice(-1), 10)] = v
    }
  })
  return newObj
}

export function appendRadixColor(colors: RadixColorsWithoutName, newColor: string): RadixColorsWithoutName {
  const newObj: RadixColorsWithoutName = {
    fg: colors.fg,
  }
  for (let i = 2; i <= 12; i++) {
    const color = colors[i]
    if (color) {
      newObj[i - 1] = color
    }
  }
  newObj[12] = newColor
  return newObj
}
