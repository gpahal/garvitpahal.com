import type { ReactNode } from 'react'

import { cn } from 'cn'

import { colOf, describeCell, rowOf } from '@/lib/x/puzzle-solvers/grid/geometry'

/**
 * The label says whether the value was printed or worked out, so a view may draw the two alike.
 */
export function SolvedCell({
  n,
  cell,
  value,
  isGiven,
  className,
  children,
}: {
  n: number
  cell: number
  value: string
  isGiven: boolean
  className?: string
  children: ReactNode
}): ReactNode {
  return (
    <div
      role="cell"
      aria-rowindex={rowOf(n, cell) + 1}
      aria-colindex={colOf(n, cell) + 1}
      aria-label={`${describeCell(n, cell)}, ${value}${isGiven ? ', given' : ', solved'}`}
      className={cn('flex aspect-square items-center justify-center bg-background', className)}
    >
      {children}
    </div>
  )
}
