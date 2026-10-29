import { ConvexError } from 'convex/values'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FORBIDDEN, UNAUTHENTICATED } from '@convex/shared/errorCodes'

import { boundaryFailure, convexFailure } from './convex-errors'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('convexFailure', () => {
  it("offers a sign-in for an unauthenticated call, passes a server's own message through and logs only the unexpected", () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(convexFailure(new ConvexError(UNAUTHENTICATED))).toMatchObject({ signIn: true })
    expect(convexFailure(new ConvexError('Enter a name'))).toEqual({ message: 'Enter a name' })
    expect(consoleError).not.toHaveBeenCalled()
    const fault = new Error('[CONVEX M(tasks:create)] [Request ID: 1234] Server Error')
    convexFailure(fault)
    expect(consoleError.mock.calls).toEqual([[fault]])
  })
})

describe('boundaryFailure', () => {
  const remedies = (error: unknown, boundary: Parameters<typeof boundaryFailure>[1]) => {
    const { message: _message, ...remedy } = boundaryFailure(error, boundary)
    return remedy
  }

  it('offers the fix that keeps drafts where they survive, else a reload', () => {
    const unauthenticated = new ConvexError(UNAUTHENTICATED)
    expect(remedies(unauthenticated, { keepsDrafts: false })).toEqual({
      reload: true,
      noRetry: true,
    })
    expect(remedies(unauthenticated, { keepsDrafts: true, subject: 'your tasks' })).toEqual({
      signIn: true,
    })
    expect(remedies(new ConvexError(FORBIDDEN), { keepsDrafts: false })).toEqual({ noRetry: true })
    expect(remedies(new Error('Server Error'), { keepsDrafts: false })).toEqual({
      reload: true,
      noRetry: true,
    })
  })
})
