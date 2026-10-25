import type { Auth } from 'convex/server'
import { ConvexError } from 'convex/values'

import { FORBIDDEN, UNAUTHENTICATED } from '../shared/errorCodes'
import { isOwnerEmail } from '../shared/ownerEmail'
import { logError } from './log'

/**
 * Rechecks what the Worker checked before minting, catching an `OWNER_EMAIL` mismatch or a Worker
 * bug. It cannot catch a leaked key: the owner's address is public, so the key holder can mint the
 * owner's token. With no `OWNER_EMAIL` nobody gets in.
 */
export async function requireOwner(ctx: { auth: Auth }): Promise<void> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError(UNAUTHENTICATED)
  }
  const ownerEmail = process.env.OWNER_EMAIL
  if (isOwnerEmail(identity.email, ownerEmail)) {
    return
  }
  // Logged on every call, re-runs included, so a misconfigured deployment stays loud until fixed.
  const isUnset = (ownerEmail?.trim() ?? '') === ''
  logError(
    isUnset ? 'auth.owner_email_unset' : 'auth.not_owner',
    isUnset ? {} : { message: 'OWNER_EMAIL differs between the Worker and Convex' },
  )
  throw new ConvexError(FORBIDDEN)
}
