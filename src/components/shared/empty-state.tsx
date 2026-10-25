import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description: string
  /**
   * The screen's primary action, shown here whether or not the screen's header also shows it.
   */
  action: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps): ReactNode {
  return (
    <div className="flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-6 text-center text-balance">
      <div className="flex max-w-sm flex-col items-center gap-2">
        <div className="font-heading text-sm font-medium tracking-tight">{title}</div>
        <div className="text-sm/relaxed text-muted-foreground">{description}</div>
      </div>
      <div className="flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5 text-sm text-balance">
        {action}
      </div>
    </div>
  )
}
