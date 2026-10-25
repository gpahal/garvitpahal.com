import { onPageReturn } from '@/lib/page-return'

/**
 * Cut short by the network coming back or the owner returning to the tab.
 */
export async function sleepUntilWoken(ms: number): Promise<'elapsed' | 'woken'> {
  return new Promise((resolve) => {
    const end = (ending: 'elapsed' | 'woken'): void => {
      clearTimeout(timer)
      globalThis.removeEventListener('online', wake)
      stopReturn()
      resolve(ending)
    }
    const wake = (): void => {
      end('woken')
    }
    const timer = setTimeout(() => {
      end('elapsed')
    }, ms)
    globalThis.addEventListener('online', wake)
    const stopReturn = onPageReturn(wake)
  })
}
