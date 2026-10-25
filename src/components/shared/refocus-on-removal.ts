import type { RefCallback } from 'react'

import { isFocusLost } from '@/lib/final-focus'

/**
 * A ref for an element that can go while focus is in it. `moveOn` runs a microtask after removal,
 * once the rest of the render is in the page, only if focus fell to the page. It gets the
 * element's former parent, since the element is detached by then.
 */
export function refocusOnRemoval(moveOn: (parent: Element) => void): RefCallback<HTMLElement> {
  return (element) => {
    if (element === null) {
      return
    }
    return () => {
      const parent = element.parentElement
      if (parent === null || !element.contains(document.activeElement)) {
        return
      }
      queueMicrotask(() => {
        if (isFocusLost()) {
          moveOn(parent)
        }
      })
    }
  }
}

export function focusEnclosingDialog(element: Element): void {
  element.closest<HTMLElement>('[role="dialog"]')?.focus()
}

export const focusDialogOnRemoval = refocusOnRemoval(focusEnclosingDialog)

/**
 * Call before removing a row with the pressed control in it: focuses the `selector` match in the
 * next row, else the previous, else `fallback`.
 */
export function focusNeighbourOf(
  container: Element | null,
  index: number,
  selector: string,
  fallback: HTMLElement | null,
): void {
  const rows = container?.children
  const neighbour = rows?.[index + 1] ?? rows?.[index - 1]
  const target = neighbour?.querySelector<HTMLElement>(selector) ?? fallback
  target?.focus()
}
