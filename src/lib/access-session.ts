import * as z from 'zod/mini'

import { failureSchema } from '@/lib/failure'

/**
 * Tells an expired Access session from a dead network in an `/api/x/*` fetch. Access answers an
 * expired session with a login redirect, which a followed fetch reports as the same `TypeError` a
 * dead network gives, so the redirect is left unfollowed; none of the site's own endpoints
 * redirects. A 401, from Access or the gate, means no usable session whatever the body says.
 */

export const ACCESS_FETCH_INIT = { redirect: 'manual' } as const satisfies RequestInit

/**
 * Only for a response fetched with `ACCESS_FETCH_INIT`. A 403 says nothing about the session, since
 * a challenge in front of the Worker answers one as readily as Access does.
 */
export function isAccessSessionExpired(response: Response): boolean {
  return response.type === 'opaqueredirect' || response.status === 401
}

/**
 * The body of every `/api/x/*` refusal. The message has no upper bound, so a long diagnostic is not
 * lost to a parse failure, and a remedy a route adds later is dropped rather than refused.
 */
export const apiRefusalSchema = z.object({ error: failureSchema })

export type ApiRefusal = z.infer<typeof apiRefusalSchema>
