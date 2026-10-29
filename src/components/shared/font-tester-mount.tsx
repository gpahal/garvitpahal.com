import { createRoot } from 'react-dom/client'

import { FontTester } from '@/components/shared/font-tester'

export function mountFontTester(fontshareFontsPath: string): void {
  const host = document.createElement('div')
  document.body.append(host)
  createRoot(host).render(<FontTester fontshareFontsPath={fontshareFontsPath} />)

  // A navigation replaces the `body`, host included; putting it back keeps the tester's state. The
  // swap and this event run in one task, so the page never paints without the override.
  document.addEventListener('astro:after-swap', () => {
    document.body.append(host)
  })
}
