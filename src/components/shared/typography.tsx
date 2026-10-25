import type { ComponentProps, ElementType, JSX, ReactNode } from 'react'

import { cn } from 'cn'

import { FOCUS_OUTLINE } from '@/components/shared/focus-outline'

/**
 * Keep class strings as literal arguments so Tailwind can discover them.
 */
function styled<Tag extends keyof JSX.IntrinsicElements>(
  tag: Tag,
  classes: string,
): (props: ComponentProps<Tag>) => ReactNode {
  function Styled(props: ComponentProps<Tag>): ReactNode {
    const { className, ...rest } = props as { className?: string }
    const Component = tag as ElementType
    return <Component className={cn(classes, className)} {...rest} />
  }
  Styled.displayName = `styled.${tag}`
  return Styled
}

export const H1 = styled('h1', 'scroll-m-20 text-3xl font-bold tracking-tight text-balance')
export const H2 = styled(
  'h2',
  'mt-8 scroll-m-20 text-xl font-semibold tracking-tight text-balance first:mt-0',
)
export const H3 = styled(
  'h3',
  'mt-6 scroll-m-20 text-lg font-semibold tracking-tight text-balance first:mt-0',
)
export const H4 = styled('h4', 'mt-5 scroll-m-20 text-base font-semibold tracking-tight first:mt-0')
export const P = styled('p', 'leading-relaxed text-pretty not-first:mt-4')

/**
 * Muted, with a close underline. The decoration has its own colour, so hover lifts only the text.
 */
export const A = styled(
  'a',
  cn(
    FOCUS_OUTLINE,
    'text-muted-foreground underline decoration-muted-foreground/60 decoration-1 underline-offset-2 transition-colors hover:text-foreground',
  ),
)
export const Ul = styled(
  'ul',
  'my-4 ml-6 list-disc leading-relaxed marker:text-muted-foreground/60 [&>li]:mt-1.5 [&>li]:text-pretty',
)
export const Ol = styled(
  'ol',
  'my-4 ml-6 list-decimal leading-relaxed marker:text-muted-foreground/60 [&>li]:mt-1.5 [&>li]:text-pretty',
)
export const Blockquote = styled('blockquote', 'mt-6 border-l-2 pl-6 italic')
export const Tr = styled('tr', 'm-0 border-t p-0 even:bg-muted')
export const Th = styled(
  'th',
  'border px-4 py-2 text-left font-bold [[align=center]]:text-center [[align=right]]:text-right',
)
export const Td = styled(
  'td',
  'border px-4 py-2 text-left [[align=center]]:text-center [[align=right]]:text-right',
)
export const Hr = styled('hr', 'my-8')
export const Strong = styled('strong', 'font-semibold')

/**
 * MDX hands the `code` override the `<code>` inside Expressive Code blocks too, so the classes only
 * apply outside `pre`.
 */
export const InlineCode = styled(
  'code',
  'not-in-[pre]:relative not-in-[pre]:rounded-sm not-in-[pre]:bg-muted not-in-[pre]:px-[0.3rem] not-in-[pre]:py-[0.2rem] not-in-[pre]:font-mono not-in-[pre]:text-sm not-in-[pre]:font-medium',
)

/**
 * A scrolling region must be focusable for keyboard users and named so that stop is announced. MDX
 * passes no props to tell tables apart, so every one has the same name.
 */
export function Table({ className, ...props }: ComponentProps<'table'>): ReactNode {
  return (
    <div
      className={cn(FOCUS_OUTLINE, 'my-6 w-full overflow-x-auto')}
      // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- a scroll container needs focus
      tabIndex={0}
      role="region"
      aria-label="Scrollable table"
    >
      <table className={cn('w-full', className)} {...props} />
    </div>
  )
}

const MUTED = 'text-sm text-muted-foreground'

export const Muted = styled('p', MUTED)

/**
 * `Muted` where a block element cannot go.
 */
export const MutedText = styled('span', MUTED)
