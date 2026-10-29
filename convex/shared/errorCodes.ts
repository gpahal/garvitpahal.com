/**
 * Codes `requireOwner` throws, matched by `src/lib/convex-errors.ts` and the Worker's
 * `convex-server.ts`.
 */

/**
 * No token, or an expired or unverifiable one. Signing in again fixes it.
 */
export const UNAUTHENTICATED = 'Unauthenticated'

/**
 * The Worker's and Convex's `OWNER_EMAIL` differ. Kept apart from `UNAUTHENTICATED` because telling
 * the caller to sign in again would send them round for ever.
 */
export const FORBIDDEN = 'Forbidden'
