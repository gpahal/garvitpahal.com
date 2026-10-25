import type { ReactNode } from 'react'

import type { Remedy } from '@/lib/failure'
import { ReloadButton } from '@/components/shared/reload-button'
import { SignInLink } from '@/components/shared/sign-in-link'

/**
 * In order: `leading`, such as a dialog's Close, a sign-in link, `children`, such as a retry, then a
 * reload.
 */
export function remedyActions(
  remedy: Remedy,
  children?: ReactNode,
  leading?: ReactNode,
): ReactNode {
  return leading !== undefined || children !== undefined || remedy.signIn || remedy.reload ? (
    <div className="flex flex-wrap gap-2">
      {leading}
      {remedy.signIn ? <SignInLink /> : undefined}
      {children}
      {remedy.reload ? <ReloadButton /> : undefined}
    </div>
  ) : undefined
}
