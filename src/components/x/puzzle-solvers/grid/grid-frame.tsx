import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, Ref } from 'react'

import { cn } from 'cn'

import { indexOf } from '@/lib/x/puzzle-solvers/grid/geometry'

/**
 * Above the 24px WCAG 2.2 minimum target, so a 16x16 grid scrolls sideways on a phone instead.
 */
const MIN_CELL_REM = 1.75

/**
 * Rows exist for ARIA only; they are `display: contents`, so every cell lays out against the same
 * tracks.
 */
export function GridFrame({
  role,
  n,
  label,
  isMultiselectable,
  renderCell,
  className,
  ref,
}: {
  /**
   * `table` for a solution, which has nothing to operate.
   */
  role: 'grid' | 'table'
  n: number
  label: string
  isMultiselectable?: boolean
  renderCell: (cell: number) => ReactNode
  className?: string
  ref?: Ref<HTMLDivElement>
}): ReactNode {
  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${String(n)}, minmax(0, 1fr))`,
    minWidth: `${String(n * MIN_CELL_REM)}rem`,
  }
  const scrollerRef = useRef<HTMLDivElement>(null)
  // Only an overflowing scroller is a tab stop. Both boxes are watched: a rotation resizes the
  // scroller, and a text size change the grid's rem-based minimum.
  const [isScrollable, setIsScrollable] = useState(false)
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const measure = (): void => {
      setIsScrollable(scroller.scrollWidth > scroller.clientWidth)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild)
    return () => {
      observer.disconnect()
    }
  }, [n])

  return (
    // Padded so the scroller does not clip focus rings at the edge.
    <div
      ref={scrollerRef}
      className="-m-1 overflow-x-auto p-1"
      {...(isScrollable
        ? { tabIndex: 0, role: 'region', 'aria-label': `${label}, scrolls sideways` }
        : {})}
    >
      <div
        ref={ref}
        role={role}
        aria-label={label}
        aria-multiselectable={isMultiselectable}
        aria-rowcount={n}
        aria-colcount={n}
        className={cn('mx-auto grid w-full max-w-md', className)}
        style={style}
      >
        {Array.from({ length: n }, (_, row) => (
          <div key={row} role="row" className="contents">
            {Array.from({ length: n }, (_, col) => renderCell(indexOf(n, row, col)))}
          </div>
        ))}
      </div>
    </div>
  )
}
