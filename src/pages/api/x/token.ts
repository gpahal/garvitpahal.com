import type { APIRoute } from 'astro'

import type { TokenResponse } from '@/lib/access-token'
import { ownerOf } from '@/lib/server/api-gate'

export const prerender = false

/**
 * Hands the page the Convex token the gate minted. Accepted risk: injected script on this origin
 * could fetch a token and leave with it through a navigation, which `connect-src` does not
 * restrict, and use it until it expires. The defence is a `script-src` that admits inline script
 * only by hash.
 */
export const GET: APIRoute = ({ locals }) =>
  Response.json({ token: ownerOf(locals).token } satisfies TokenResponse)
