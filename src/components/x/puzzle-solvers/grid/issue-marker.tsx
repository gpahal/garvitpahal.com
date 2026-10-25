import type { ReactNode } from 'react'

import { cn } from 'cn'

/**
 * The cell must be `relative`; `className` sets the size and inset, which follow the cell's text.
 */
export function IssueMarker({ className }: { className: string }): ReactNode {
  return (
    <span
      aria-hidden="true"
      className={cn('absolute leading-none font-bold text-destructive', className)}
    >
      !
    </span>
  )
}
