import { useEffect, useEffectEvent, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * Calls `onOutside` when a pointer press and its release both land outside the ref's element. On
 * `pointerdown` alone the pressed button would move away before its click; on `click` alone it
 * would fire for keyboard activation and for a press dragged out from inside.
 */
export function useClickOutside<TElement extends HTMLElement>(
  onOutside: () => void,
  isEnabled = true,
): RefObject<TElement | null> {
  const elementRef = useRef<TElement>(null)
  // An effect event, so a caller passing a fresh closure each render does not resubscribe.
  const onOutsideEvent = useEffectEvent(onOutside)

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    let hasPressedOutside = false

    function isOutside(target: EventTarget | null): boolean {
      const element = elementRef.current
      return element !== null && target instanceof Node && !element.contains(target)
    }

    function onPointerDown(event: PointerEvent): void {
      hasPressedOutside = isOutside(event.target)
    }

    function onClick(event: MouseEvent): void {
      const wasPressedOutside = hasPressedOutside
      hasPressedOutside = false
      // `detail` counts the clicks so far, so a click synthesised from the keyboard reports none.
      if (!wasPressedOutside || event.detail === 0 || !isOutside(event.target)) {
        return
      }
      onOutsideEvent()
    }

    // The press is captured so no handler can hide it, but the release bubbles, after React has
    // dispatched the click: acting first can unmount the pressed element before its handler runs.
    document.addEventListener('pointerdown', onPointerDown, { capture: true })
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true })
      document.removeEventListener('click', onClick)
    }
  }, [isEnabled])

  return elementRef
}
