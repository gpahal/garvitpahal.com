import type { Failure, Remedy } from '@/lib/failure'

/**
 * Only these messages reach the owner; any other error reads as a message worded for its
 * operation, so never wrap internal detail in one.
 */
export class UserFacingError extends Error {
  override name = 'UserFacingError'

  readonly failure: Failure

  constructor(message: string, remedy: Remedy = {}, options?: ErrorOptions) {
    super(message, options)
    this.failure = { ...remedy, message }
  }
}

export function failureOf(error: unknown, fallback: string): Failure {
  return error instanceof UserFacingError ? error.failure : { message: fallback }
}
