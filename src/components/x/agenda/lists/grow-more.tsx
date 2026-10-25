import { use } from 'react'
import type { ReactNode } from 'react'

import { MAX_LIST } from '@convex/shared/limits'

import type { GrowingLimit } from '@/hooks/use-growing-limit'
import { LoadingBlockedContext } from '@/components/shared/loading-blocked-context'
import { PendingButton } from '@/components/shared/pending-button'
import { refocusOnRemoval } from '@/components/shared/refocus-on-removal'
import { Muted } from '@/components/shared/typography'

/**
 * A list's row is an `li` holding the one button that opens it.
 */
const ROW = 'li button'
const CONTROL = 'a[href], button:not(:disabled)'

/**
 * Once the button has gone (the list ended or an outage hid it), focus moves to the first control
 * after the list's section, else to its last row, just above where the button was.
 */
const focusAfterButton = refocusOnRemoval((container) => {
  if (!container.isConnected) {
    return
  }
  let next: HTMLElement | undefined
  if (container.localName === 'section') {
    for (let el = container.nextElementSibling; el && !next; el = el.nextElementSibling) {
      const control = el.matches(CONTROL) ? el : el.querySelector(CONTROL)
      next = control instanceof HTMLElement ? control : undefined
    }
  }
  const target = next ?? [...container.querySelectorAll<HTMLElement>(ROW)].at(-1)
  target?.focus()
})

type GrowMoreProps = {
  growing: GrowingLimit
  hasMore: boolean
  isLoading: boolean
}

/**
 * Raises a list's growing limit a step. At the read cap it says the list is cut instead, and it
 * yields to the connectivity notice during an outage.
 */
export function GrowMore({ growing, hasMore, isLoading }: GrowMoreProps): ReactNode {
  const isBlocked = use(LoadingBlockedContext)

  if (hasMore && !isLoading && !growing.canGrow) {
    return (
      <Muted className="self-center">
        This list shows at most {MAX_LIST.toLocaleString('en')}, and there are more than that
      </Muted>
    )
  }
  return isBlocked || (!hasMore && !isLoading) ? undefined : (
    <PendingButton
      ref={focusAfterButton}
      variant="outline"
      className="self-center"
      isPending={isLoading}
      pendingLabel="Loading…"
      onClick={growing.grow}
    >
      Load more
    </PendingButton>
  )
}
