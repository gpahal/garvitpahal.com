import * as z from 'zod/mini'

const remedy = z.optional(z.literal(true))

/**
 * A message for the owner and what the page may offer beside it. Whoever makes a failure knows its
 * remedy, so the remedy travels with it, across the wire too, and no reader classifies it again.
 */
export const failureSchema = z.object({
  message: z.string().check(z.minLength(1)),
  // Signing in again in a new tab may fix it, so the page links there.
  signIn: remedy,
  // Only a reload fixes it, so the page offers one.
  reload: remedy,
  // Trying again would meet it again, so the page offers no Try again.
  noRetry: remedy,
  // Permits a puzzle read's paid fallback. Absent means none.
  fallback: remedy,
})

export type Failure = z.infer<typeof failureSchema>

export type Remedy = Omit<Failure, 'message'>

/**
 * For any server setting that stops a request, wherever it lives. The server's log names the
 * setting.
 */
export const SERVER_SETTINGS_MESSAGE = 'The server is not set up correctly. Try again later'
