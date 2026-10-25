import { use } from 'react'
import type { ReactNode } from 'react'

import { LoadingBlockedContext } from '@/components/shared/loading-blocked-context'

export function Loading({ inline = false }: { inline?: boolean }): ReactNode {
  const isBlocked = use(LoadingBlockedContext)
  if (isBlocked) {
    return undefined
  }

  // Only the block is a live region: the inline one sits in text, such as a dialog's description,
  // that is read with its dialog.
  return inline ? (
    <span>Loading…</span>
  ) : (
    <p role="status" className="text-muted-foreground">
      Loading…
    </p>
  )
}
