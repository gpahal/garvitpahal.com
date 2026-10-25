import type { ReactNode } from 'react'

import { cn } from 'cn'

import { DialogFooter } from '@/components/ui/dialog'

/**
 * Shrinks rather than scrolls, keeping the footer in view on a phone. Where there is room it keeps
 * one frame for every step, so the dialog does not resize between them.
 */
export function CaptureDialogMedia({
  className,
  isBusy = false,
  children,
}: {
  className?: string
  isBusy?: boolean
  children: ReactNode
}): ReactNode {
  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-muted" aria-busy={isBusy}>
      <div aria-hidden="true" className="aspect-3/4 w-full sm:aspect-video" />
      <div className={cn('absolute inset-0', className)}>{children}</div>
    </div>
  )
}

export function CaptureDialogFooter({ children }: { children: ReactNode }): ReactNode {
  return (
    // Untinted: a pressed toggle's `bg-muted` barely shows on the footer's usual `bg-muted/50`.
    <DialogFooter className="flex-col bg-transparent sm:flex-col">{children}</DialogFooter>
  )
}
