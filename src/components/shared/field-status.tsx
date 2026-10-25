import type { ReactNode } from 'react'

import { FieldError } from '@/components/ui/field'

type FieldStatusProps = {
  id: string
  /**
   * A negative `empty:` top margin that cancels the parent's gap; the default cancels a `Field`'s.
   */
  className?: string
  children: string | undefined
}

/**
 * Mount it even when empty: a live region is announced only if it was in the tree before its
 * contents changed. Polite, since a value can be briefly invalid on the way to a valid one.
 */
export function FieldStatus({
  id,
  className = 'empty:-mt-2',
  children,
}: FieldStatusProps): ReactNode {
  return (
    <div role="status" className={className}>
      <FieldError id={id} role="presentation">
        {children}
      </FieldError>
    </div>
  )
}
