import type { ComponentProps, ReactNode } from 'react'

import { cn } from 'cn'

type EditorCellProps = ComponentProps<'button'> & {
  isSelected: boolean
}

/**
 * Spread `cellProps(cell)` from `useGridSelection` onto it.
 */
export function EditorCell({
  isSelected,
  className,
  children,
  ...props
}: EditorCellProps): ReactNode {
  return (
    <button
      type="button"
      role="gridcell"
      {...props}
      className={cn(
        'relative flex aspect-square items-center justify-center outline-none',
        className,
        // Raised so a neighbour's border does not clip the marker.
        isSelected && 'z-20',
      )}
    >
      {/*
       * An overlay rather than an `outline`, which border widths that differ by side would make
       * uneven.
       */}
      {isSelected ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 border-2 border-primary"
        />
      ) : undefined}
      {children}
    </button>
  )
}
