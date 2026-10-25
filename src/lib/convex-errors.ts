import { ConvexError } from 'convex/values'

import { FORBIDDEN, UNAUTHENTICATED } from '@convex/shared/errorCodes'

import { SERVER_SETTINGS_MESSAGE } from '@/lib/failure'
import type { Failure } from '@/lib/failure'

/**
 * Matches on `data`, since production redacts a server error's message but not `ConvexError` data.
 */
function hasCode(error: unknown, code: string): boolean {
  return error instanceof ConvexError && error.data === code
}

function isUnauthenticated(error: unknown): boolean {
  return hasCode(error, UNAUTHENTICATED)
}

function isForbidden(error: unknown): boolean {
  return hasCode(error, FORBIDDEN)
}

/**
 * For anything but a `ConvexError` carrying a sentence; the error itself goes to the console.
 */
const UNEXPECTED_MESSAGE =
  'The server could not do this. Try again. If it keeps happening, reload, which loses anything unsaved'

const SIGN_IN_AGAIN_MESSAGE =
  'The server did not accept your sign-in. Sign in again in a new tab, then try again. Reloading this page loses anything unsaved'

function wordError(error: unknown): { message: string; isExpected: boolean } {
  if (isUnauthenticated(error)) {
    return { message: SIGN_IN_AGAIN_MESSAGE, isExpected: true }
  }
  if (isForbidden(error)) {
    return { message: SERVER_SETTINGS_MESSAGE, isExpected: true }
  }
  return error instanceof ConvexError && typeof error.data === 'string'
    ? { message: error.data, isExpected: true }
    : { message: UNEXPECTED_MESSAGE, isExpected: false }
}

/**
 * What a failed Convex call says to the form that made it, with a sign-in link where that is the
 * fix.
 */
export function convexFailure(error: unknown): Failure {
  const { message, isExpected } = wordError(error)
  if (!isExpected) {
    console.error(error)
  }
  return isUnauthenticated(error) ? { message, signIn: true } : { message }
}

/**
 * What a query error boundary shows: a reload once drafts are gone, else a fix that keeps them.
 */
export function boundaryFailure(
  error: unknown,
  {
    keepsDrafts,
    subject,
  }: { keepsDrafts: false; subject?: never } | { keepsDrafts: true; subject?: string },
): Failure {
  if (isUnauthenticated(error)) {
    return keepsDrafts
      ? { message: SIGN_IN_AGAIN_MESSAGE, signIn: true }
      : {
          message: 'The server did not accept your sign-in. Reload this page to sign in again',
          reload: true,
          noRetry: true,
        }
  }
  if (isForbidden(error)) {
    return { message: SERVER_SETTINGS_MESSAGE, noRetry: true }
  }
  const { message, isExpected } = wordError(error)
  const fault =
    subject === undefined
      ? `The server could not load this. Reload the page to try again${keepsDrafts ? ', which loses anything unsaved' : ''}`
      : `The server could not load ${subject}. Try again, or reload the page, which loses anything unsaved`
  const failure: Failure = { message: isExpected ? message : fault, reload: true }
  return subject === undefined ? { ...failure, noRetry: true } : failure
}
