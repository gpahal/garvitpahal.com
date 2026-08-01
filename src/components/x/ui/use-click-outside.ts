import { useEffect, useRef, type RefObject } from 'react'

/**
 * Calls `onOutside` when a pointer goes down anywhere outside the returned ref's element.
 *
 * `pointerdown` rather than `focusout`, which would fire on Tab as well: pulling controls out of the
 * page the moment a keyboard user tabs past them changes the tab order under their feet. This only
 * ever fires for a deliberate press somewhere else.
 *
 * Put the ref on whatever the user would call "the thing", controls included - a press on a control
 * belonging to the selection is not a press outside it.
 */
export function useClickOutside<TElement extends HTMLElement>(
  onOutside: () => void,
  isEnabled = true,
): RefObject<TElement | null> {
  const elementRef = useRef<TElement>(null)
  // Held in a ref so a caller passing a fresh closure each render does not resubscribe each render.
  const handlerRef = useRef(onOutside)

  useEffect(() => {
    handlerRef.current = onOutside
  }, [onOutside])

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    function onPointerDown(event: PointerEvent): void {
      const element = elementRef.current
      if (element && event.target instanceof Node && !element.contains(event.target)) {
        handlerRef.current()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [isEnabled])

  return elementRef
}
