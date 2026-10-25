import type { ReactNode } from 'react'

import { formatWait } from '@/lib/x/puzzle-solvers/format-wait'
import { useTickingNow } from '@/hooks/use-ticking-now'
import { Muted } from '@/components/shared/typography'

/**
 * Assistive tech gets the clock time once rather than the ticking text every second.
 */
export function RetryWait({ id, retryAt }: { id: string; retryAt: number }): ReactNode {
  const now = useTickingNow(1000)

  const at = new Date(retryAt).toLocaleTimeString([], { timeStyle: 'medium' })
  return (
    <Muted id={id} className="text-center">
      <span aria-hidden="true" className="tabular-nums">
        Reading is paused. Try again in {formatWait(retryAt - now)}
      </span>
      <span className="sr-only">Reading is paused. You can try again after {at}</span>
    </Muted>
  )
}
