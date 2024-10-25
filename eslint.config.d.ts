export * from 'astro/astro-jsx'

declare global {
  namespace JSX {
    type Element = HTMLElement
  }
}
