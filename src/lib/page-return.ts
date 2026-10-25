/**
 * On window focus or the tab showing again, since either can happen without the other.
 */
export function onPageReturn(callback: () => void): () => void {
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      callback()
    }
  }
  globalThis.addEventListener('focus', callback)
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    globalThis.removeEventListener('focus', callback)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
