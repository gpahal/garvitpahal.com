import { expect, test } from 'vitest'

import { isAtOrUnder, isPrivatePath, isUnlistedPath } from './site'

test('matches a path prefix and what is below it, never a path that only starts with the same letters', () => {
  expect(isAtOrUnder('/x/agenda/tasks', '/x')).toBe(true)
  expect(isAtOrUnder('/xyz', '/x')).toBe(false)
  expect(isPrivatePath('/x/puzzle-solvers')).toBe(true)
  expect(isPrivatePath('/api/x/token')).toBe(false)
  // The private area, /nav and the not-found page stay out of search, and only those.
  expect(isUnlistedPath('/nav')).toBe(true)
  expect(isUnlistedPath('/x')).toBe(true)
  expect(isUnlistedPath('/404')).toBe(true)
  expect(isUnlistedPath('/blog')).toBe(false)
  expect(isUnlistedPath('/404-notes')).toBe(false)
})
