import { cn } from 'cn'

import { FOCUS_OUTLINE } from '@/components/shared/focus-outline'

/**
 * The classes `proseClasses` in `astro.config.ts` adds to rendered Markdown, by tag, and the
 * components in `typography.tsx` use outside it.
 */
export const PROSE_CLASSES = {
  h1: 'scroll-m-20 text-3xl font-bold tracking-tight text-balance',
  h2: 'mt-8 scroll-m-20 text-xl font-semibold tracking-tight text-balance first:mt-0',
  h3: 'mt-6 scroll-m-20 text-lg font-semibold tracking-tight text-balance first:mt-0',
  h4: 'mt-5 scroll-m-20 text-base font-semibold tracking-tight first:mt-0',
  p: 'leading-relaxed text-pretty not-first:mt-4',
  // Muted, with a close underline. The decoration has its own colour, so hover lifts only the text.
  a: cn(
    FOCUS_OUTLINE,
    'text-muted-foreground underline decoration-muted-foreground/60 decoration-1 underline-offset-2 transition-colors hover:text-foreground',
  ),
  ul: 'my-4 ml-6 list-disc leading-relaxed marker:text-muted-foreground/60 [&>li]:mt-1.5 [&>li]:text-pretty',
  ol: 'my-4 ml-6 list-decimal leading-relaxed marker:text-muted-foreground/60 [&>li]:mt-1.5 [&>li]:text-pretty',
  blockquote: 'mt-6 border-l-2 pl-6 italic',
  table: 'w-full',
  tr: 'm-0 border-t p-0 even:bg-muted',
  th: 'border px-4 py-2 text-left font-bold',
  td: 'border px-4 py-2 text-left',
  hr: 'my-8',
  strong: 'font-semibold',
  // Inline code only: `proseClasses` skips the `<code>` in a `pre`, which Expressive Code styles.
  code: 'relative rounded-sm bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-medium',
}

/**
 * Wraps each table. A scrolling region must be focusable for keyboard users and named so that stop
 * is announced; nothing tells tables apart, so every one has the same name.
 */
export const TABLE_SCROLL_REGION = {
  className: cn(FOCUS_OUTLINE, 'my-6 w-full overflow-x-auto'),
  tabIndex: 0,
  role: 'region',
  ariaLabel: 'Scrollable table',
}
