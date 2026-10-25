import { useRef } from 'react'
import type { ReactNode } from 'react'

import { boundaryFailure } from '@/lib/convex-errors'
import { ErrorBoundary } from '@/components/shared/error-boundary'

type ListsBoundaryProps = {
  /**
   * Named as what failed to load, such as `your tasks`.
   */
  subject: string
  resetKey?: unknown
  children: ReactNode
}

/**
 * Catches a screen's list reads below its dialogs, so a failed read, say after a deploy changes its
 * shape, replaces only the lists and every open draft stays. The drafts outlive it, so a sign-in is
 * renewed in a new tab (`boundaryFailure`).
 */
export function ListsBoundary({ subject, resetKey, children }: ListsBoundaryProps): ReactNode {
  // Takes focus from Try again, which goes as the lists come back.
  const containerRef = useRef<HTMLDivElement | null>(null)
  return (
    <div ref={containerRef} tabIndex={-1} className="flex flex-col gap-8 outline-none">
      <ErrorBoundary
        failureOf={(error) => boundaryFailure(error, { keepsDrafts: true, subject })}
        onTryAgain={() => {
          containerRef.current?.focus()
        }}
        resetKey={resetKey}
      >
        {children}
      </ErrorBoundary>
    </div>
  )
}
