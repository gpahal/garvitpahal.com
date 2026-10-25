import { isUnset, mintConvexToken, misconfigured } from '@/lib/server/convex-token'
import type {
  OwnerTokenOutcome,
  OwnerTokenSettings,
  SigningKeyCache,
} from '@/lib/server/convex-token'
import { logEvent } from '@/lib/server/log'

/**
 * Development only: mints a token for `OWNER_EMAIL` unverified, as `pnpm dev` has no Access. A build
 * drops this module, which is its own so no source map carries it, and `.github/workflows/check.yml`
 * fails a `dist/server` containing the log event below.
 */
export async function mintDevOwnerToken(
  settings: Pick<OwnerTokenSettings, 'ownerEmail' | 'privateKey'>,
  deps: { signingKey: SigningKeyCache; now: () => number },
): Promise<OwnerTokenOutcome> {
  const ownerEmail = settings.ownerEmail?.trim()
  const privateKey = settings.privateKey?.trim()
  if (isUnset(ownerEmail) || isUnset(privateKey)) {
    return misconfigured(
      "Local development mints its Convex token from OWNER_EMAIL and CONVEX_JWT_PRIVATE_KEY, which `pnpm dev` reads from Infisical's dev environment; set both there and start the server with `pnpm dev`, not `pnpm dev:public` (README, Running the private tools)",
    )
  }
  const key = await deps.signingKey(privateKey)
  if ('status' in key) {
    return key
  }
  const token = await mintConvexToken(key, ownerEmail, deps.now())
  logEvent('auth.dev_only_unverified_owner_token', {})
  return { status: 'ok', token }
}
