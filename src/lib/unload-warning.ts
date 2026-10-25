/**
 * The browser's leave-page warning, for unloading and for `<ClientRouter />` navigation. Back and
 * Forward are not held: by the time Astro sees them the URL has already changed.
 */

const owners = new Set<object>()

/**
 * Older engines that needed the deprecated `returnValue` leave without asking.
 */
function warn(event: BeforeUnloadEvent): void {
  event.preventDefault()
}

/**
 * Astro 7 cannot cancel a navigation, but a prevented `astro:before-preparation` falls back to a
 * full load, which fires `beforeunload`. A router form POST would lose its body there, so every
 * form prevents its own submission or uses `method="dialog"`.
 */
function holdNavigation(event: DocumentEventMap['astro:before-preparation']): void {
  if (event.navigationType !== 'traverse') {
    event.preventDefault()
  }
}

/**
 * Holds are independent, so a pending write keeps its warning when its dialog is closed.
 */
export function retainUnloadWarning(): () => void {
  const owner = {}
  if (owners.size === 0) {
    window.addEventListener('beforeunload', warn)
    document.addEventListener('astro:before-preparation', holdNavigation)
  }
  owners.add(owner)
  return () => {
    owners.delete(owner)
    if (owners.size > 0) {
      return
    }
    window.removeEventListener('beforeunload', warn)
    document.removeEventListener('astro:before-preparation', holdNavigation)
  }
}
