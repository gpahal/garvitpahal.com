/**
 * Opens and closes the mobile menu in `index.astro`. A bundled script runs once per full load and
 * the swap replaces the dialog, so listeners live on `document` and find it at event time.
 */

function findOpenDialog() {
  return document.querySelector<HTMLDialogElement>('dialog[data-mobile-nav][open]')
}

/**
 * Not shared: a script that imports nothing is inlined, where an import would make it a module
 * fetched after the page.
 */
function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

// Capture, so `preventDefault` lands before the router's own `document` click listener runs.
document.addEventListener(
  'click',
  (event) => {
    if (!(event.target instanceof Element)) {
      return
    }

    const trigger = event.target.closest<HTMLElement>('[data-mobile-nav-trigger]')
    if (trigger) {
      const dialog = document.querySelector<HTMLDialogElement>('dialog[data-mobile-nav]')
      // Anything unexpected falls through to the link, and `/nav` loads.
      if (!dialog || !isPlainClick(event) || typeof dialog.showModal !== 'function') {
        return
      }
      event.preventDefault()
      // Closing returns focus to what had it, and Safari does not focus a link on a tap.
      trigger.focus()
      dialog.showModal()
      return
    }

    // The backdrop targets the dialog itself. A plain click on a link closes first so the swap
    // never sees a modal.
    const dialog = event.target.closest<HTMLDialogElement>('dialog[data-mobile-nav]')
    if (dialog && (event.target === dialog || (event.target.closest('a') && isPlainClick(event)))) {
      dialog.close()
    }
  },
  { capture: true },
)

// Without this script the trigger is a plain link to `/nav`.
document.addEventListener('astro:page-load', () => {
  document.querySelector('[data-mobile-nav-trigger]')?.setAttribute('aria-haspopup', 'dialog')
})

// Back and forward navigate with the menu open.
document.addEventListener('astro:before-swap', () => findOpenDialog()?.close())

// Tailwind's `lg`, where the sidebar takes over.
matchMedia('(width >= 64rem)').addEventListener('change', (event) => {
  if (event.matches) {
    findOpenDialog()?.close()
  }
})
