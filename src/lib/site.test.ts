import { expect, test } from 'vitest'

import { isAtOrUnder } from './site'

test('matches a path prefix and what is below it, never a path that only starts with the same letters', () => {
  expect(isAtOrUnder('/x/agenda/tasks', '/x')).toBe(true)
  expect(isAtOrUnder('/xyz', '/x')).toBe(false)
})
