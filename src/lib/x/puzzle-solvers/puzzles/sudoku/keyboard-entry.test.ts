import { describe, expect, it } from 'vitest'

import { readKeyboardEntry, readTwoDigitWindowEnd, TWO_DIGIT_WINDOW_MS } from './keyboard-entry'
import { EMPTY } from './model'

describe('readKeyboardEntry', () => {
  it('reads a digit the grid holds and 0 as a clear, and nothing else', () => {
    expect(readKeyboardEntry('7', 9, 0, undefined, 0)).toEqual({ value: 7, isSecondDigit: false })
    expect(readKeyboardEntry('0', 9, 0, undefined, 0)).toEqual({
      value: EMPTY,
      isSecondDigit: false,
    })
    expect(readKeyboardEntry('7', 6, 0, undefined, 0)).toBeUndefined()
    expect(readKeyboardEntry('a', 9, 0, undefined, 0)).toBeUndefined()
    expect(readKeyboardEntry('12', 16, 0, undefined, 0)).toBeUndefined()
  })

  it('joins a 1 and a second digit in the same cell within the window, only on grids above 9', () => {
    expect(readKeyboardEntry('1', 9, 4, undefined, 100)).toEqual({ value: 1, isSecondDigit: false })
    expect(readKeyboardEntry('1', 16, 4, undefined, 100)).toEqual({
      value: 1,
      isSecondDigit: false,
      pending: { cell: 4, at: 100 },
    })
    const pending = { cell: 4, at: 100 }
    expect(readKeyboardEntry('6', 16, 4, pending, 100 + TWO_DIGIT_WINDOW_MS)).toEqual({
      value: 16,
      isSecondDigit: true,
    })
    expect(readKeyboardEntry('0', 12, 4, pending, 500)).toEqual({ value: 10, isSecondDigit: true })
  })

  it('starts a new value after the window, in another cell or past the grid', () => {
    const pending = { cell: 4, at: 100 }
    expect(readKeyboardEntry('2', 16, 4, pending, 101 + TWO_DIGIT_WINDOW_MS)).toEqual({
      value: 2,
      isSecondDigit: false,
    })
    expect(readKeyboardEntry('2', 16, 5, pending, 200)).toEqual({ value: 2, isSecondDigit: false })
    // 15 does not fit a 12x12, so the 5 stands alone.
    expect(readKeyboardEntry('5', 12, 4, pending, 200)).toEqual({ value: 5, isSecondDigit: false })
  })
})

function press(
  key: string,
  chord: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {},
): ReturnType<typeof readTwoDigitWindowEnd> {
  return readTwoDigitWindowEnd({ key, ctrlKey: false, metaKey: false, altKey: false, ...chord })
}

describe('readTwoDigitWindowEnd', () => {
  it('ends the window on keys that enter or move, and leaves it alone on the rest', () => {
    for (const key of ['1', 'Backspace']) expect(press(key), key).toBe('entry')
    // Space clicks the cell, which drops a held announcement.
    for (const key of ['ArrowUp', ' ']) expect(press(key), key).toBe('finish')
    for (const key of ['Shift', 'a']) expect(press(key), key).toBeUndefined()
    // A chord is the browser's or the system's, even one on a digit or an arrow.
    expect(press('1', { ctrlKey: true })).toBeUndefined()
    expect(press('ArrowRight', { altKey: true })).toBeUndefined()
    // Except Control+Home and Control+End, which move the selection.
    for (const key of ['Home', 'End']) {
      expect(press(key), key).toBe('finish')
      expect(press(key, { ctrlKey: true }), `Control+${key}`).toBe('finish')
      expect(press(key, { metaKey: true }), `Meta+${key}`).toBeUndefined()
      expect(press(key, { ctrlKey: true, altKey: true }), `Control+Alt+${key}`).toBeUndefined()
    }
  })
})
