import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * For a control outside the container that acts on the selected child: pressing it takes focus
 * along, and the arrow keys only work from a child.
 */
export function focusRovingChild(container: HTMLElement | null, index: number | undefined): void {
  if (index !== undefined) {
    container?.querySelectorAll<HTMLElement>('[tabindex]')[index]?.focus()
  }
}

/**
 * Roving tabindex, so a screen reader narrates each selection. Children set `tabIndex` themselves,
 * `0` on the selected one only (or a stand-in when nothing is selected), in `selectedIndex` order.
 * Focus moves only when already inside the container.
 */
export function useRovingFocus<TElement extends HTMLElement>(
  selectedIndex: number | undefined,
): RefObject<TElement | null> {
  const containerRef = useRef<TElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (container?.contains(document.activeElement)) {
      focusRovingChild(container, selectedIndex)
    }
  }, [selectedIndex])

  return containerRef
}
