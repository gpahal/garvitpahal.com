import type { ReactNode } from 'react'

import { ButtonLink } from '@/components/shared/button-link'

/**
 * Signs in again to Access from a new tab. Access cookies are shared across tabs, so the page that
 * asked keeps its drafts and can retry once the new tab has signed in; a reload would lose them.
 */
export function SignInLink(): ReactNode {
  return (
    <ButtonLink href="/x" target="_blank" rel="noopener" variant="outline">
      Sign in again in a new tab
    </ButtonLink>
  )
}
