import { chordOf } from '../../grid/geometry'
import type { Keystroke } from '../../grid/geometry'

export const TWO_DIGIT_WINDOW_MS = 1000

export type PendingTens = { cell: number; at: number }

type KeyboardEntry = { value: number; isSecondDigit: boolean; pending?: PendingTens }

/**
 * On grids above 9 a 1 is entered at once, so a lone 1 needs no wait, and a second digit in the same
 * cell within `TWO_DIGIT_WINDOW_MS` replaces it with 10-16 when the grid holds that value.
 */
export function readKeyboardEntry(
  key: string,
  n: number,
  cell: number,
  pending: PendingTens | undefined,
  now: number,
): KeyboardEntry | undefined {
  if (!/^\d$/.test(key)) {
    return undefined
  }
  const digit = Number(key)
  if (pending?.cell === cell && now - pending.at <= TWO_DIGIT_WINDOW_MS && 10 + digit <= n) {
    return { value: 10 + digit, isSecondDigit: true }
  }
  if (digit > n) {
    return undefined
  }
  return {
    value: digit,
    isSecondDigit: false,
    ...(digit === 1 && n >= 10 && { pending: { cell, at: now } }),
  }
}

/**
 * An `'entry'` key's announcement replaces the held one. A `'finish'` key keeps the value and reads
 * it out at once, while it still names its cell; Space counts because it clicks the cell, which
 * drops a held announcement. A browser chord leaves the window alone, or Control+1 would silence the
 * held 1 while entering nothing.
 */
export function readTwoDigitWindowEnd(keystroke: Keystroke): 'entry' | 'finish' | undefined {
  if (chordOf(keystroke) === 'browser') {
    return undefined
  }
  const { key } = keystroke
  if (key === 'Backspace' || key === 'Delete' || /^\d$/.test(key)) {
    return 'entry'
  }
  switch (key) {
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'Home':
    case 'End':
    case 'Escape':
    case 'Tab':
    case 'Enter':
    case ' ': {
      return 'finish'
    }
    default: {
      return undefined
    }
  }
}
