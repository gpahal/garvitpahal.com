import { useEffect, useRef, type RefObject } from 'react'

/**
 * Roving tabindex: one child is tabbable at a time and the arrow keys move real focus between them,
 * rather than the container holding focus while a selection moves underneath it. Without it a
 * screen reader announces the container once and then narrates nothing as the selection changes.
 *
 * Returns a ref for the container. Children must set `tabIndex` themselves - only the selected one
 * gets `0` - and be focusable in the same order `selectedIndex` counts in.
 *
 * Focus is only moved when it is already inside the container, so the first render cannot yank it
 * away from wherever the user actually is.
 *
 * `undefined` means nothing is selected. Focus is left alone: a container with no selection still
 * has to be reachable by Tab, so a child stands in as the tabbable one without being focused.
 */
export function useRovingFocus<TElement extends HTMLElement>(
  selectedIndex: number | undefined,
): RefObject<TElement | null> {
  const containerRef = useRef<TElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (selectedIndex === undefined || !container?.contains(document.activeElement)) {
      return
    }
    const target = container.querySelectorAll<HTMLElement>('[tabindex]')[selectedIndex]
    if (target && target !== document.activeElement) {
      target.focus()
    }
  }, [selectedIndex])

  return containerRef
}
