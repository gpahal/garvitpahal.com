import { ConvexError } from 'convex/values'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FORBIDDEN, UNAUTHENTICATED } from '@convex/shared/errorCodes'

import { SERVER_SETTINGS_MESSAGE } from '@/lib/failure'

import { boundaryFailure, convexFailure } from './convex-errors'

const UNEXPECTED =
  'The server could not do this. Try again. If it keeps happening, reload, which loses anything unsaved'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('convexFailure', () => {
  it("words the owner-check refusals, passes a server's own message through, and logs none", () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(convexFailure(new ConvexError(UNAUTHENTICATED))).toEqual({
      message: expect.stringMatching(/sign in again in a new tab/i) as string,
      signIn: true,
    })
    expect(convexFailure(new ConvexError(FORBIDDEN))).toEqual({
      message: expect.stringMatching(/is not set up correctly/) as string,
    })
    expect(convexFailure(new ConvexError('Enter a name'))).toEqual({ message: 'Enter a name' })
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('words every other error the same, and logs it', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const errors = [
      new Error('[CONVEX M(tasks:create)] [Request ID: 1234] Server Error'),
      new ConvexError({ code: 'unexpected' }),
      'nope',
    ]
    for (const error of errors) {
      expect(convexFailure(error).message).toBe(UNEXPECTED)
    }
    expect(consoleError.mock.calls).toEqual(errors.map((error) => [error]))
  })
})

describe('boundaryFailure', () => {
  const SIGN_IN_AGAIN = convexFailure(new ConvexError(UNAUTHENTICATED)).message
  const RELOAD_TO_SIGN_IN =
    'The server did not accept your sign-in. Reload this page to sign in again'
  const PAGE_FAULT = 'The server could not load this. Reload the page to try again'
  const DIALOG_FAULT =
    'The server could not load this. Reload the page to try again, which loses anything unsaved'
  const LISTS_FAULT =
    'The server could not load your tasks. Try again, or reload the page, which loses anything unsaved'
  const BOUNDARIES = {
    page: { keepsDrafts: false },
    lists: { keepsDrafts: true, subject: 'your tasks' },
    dialog: { keepsDrafts: true },
  } as const
  const ERRORS = {
    unauthenticated: new ConvexError(UNAUTHENTICATED),
    forbidden: new ConvexError(FORBIDDEN),
    refusal: new ConvexError('Enter a name'),
    fault: new Error('[CONVEX Q(tasks:list)] [Request ID: 1234] Server Error'),
  }

  it.each([
    ['page', 'unauthenticated', { message: RELOAD_TO_SIGN_IN, reload: true, noRetry: true }],
    ['page', 'forbidden', { message: SERVER_SETTINGS_MESSAGE, noRetry: true }],
    ['page', 'refusal', { message: 'Enter a name', reload: true, noRetry: true }],
    ['page', 'fault', { message: PAGE_FAULT, reload: true, noRetry: true }],
    ['lists', 'unauthenticated', { message: SIGN_IN_AGAIN, signIn: true }],
    ['lists', 'refusal', { message: 'Enter a name', reload: true }],
    ['lists', 'fault', { message: LISTS_FAULT, reload: true }],
    ['dialog', 'fault', { message: DIALOG_FAULT, reload: true, noRetry: true }],
  ] as const)('shows the %s boundary a %s as %o', (boundary, error, failure) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(boundaryFailure(ERRORS[error], BOUNDARIES[boundary])).toEqual(failure)
    // The boundary logs what it catches.
    expect(consoleError).not.toHaveBeenCalled()
  })
})
