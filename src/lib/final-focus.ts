type Placed = { isConnected: boolean; parentElement: Placed | null }

/**
 * The opener and its ancestors below the body, nearest first. Take it when a dialog opens: a
 * removed row keeps no path back to the page.
 */
export function ancestryOf<T extends Placed>(opener: T): Array<T> {
  const chain: Array<T> = []
  // Only an element below the body has a grandparent element.
  for (
    let element: Placed | null = opener;
    element.parentElement?.parentElement != null;
    element = element.parentElement
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- `T` is an element type, which its ancestors share
    chain.push(element as T)
  }
  return chain
}

/**
 * For Base UI's `finalFocus`, which leaves focus on the body when the dialog's action removed its
 * opener. The nearest surviving ancestor stands in, and Base UI focuses its first tabbable element.
 * `true` keeps Base UI's own choice when nothing survives.
 */
export function finalFocusOf<T extends Placed>(ancestry: Array<T>): T | true {
  return ancestry.find((element) => element.isConnected) ?? true
}

/**
 * Whether focus has fallen to the page or nowhere, as when what held it is removed or disabled.
 * Given `element`, falling to its dialog's popup counts too.
 */
export function isFocusLost(element?: Element): boolean {
  const active = document.activeElement
  return (
    active === null || active === document.body || active === element?.closest('[role="dialog"]')
  )
}
