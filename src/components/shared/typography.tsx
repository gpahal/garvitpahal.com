import type { ComponentProps, ElementType, JSX, ReactNode } from 'react'

import { cn } from 'cn'

import { PROSE_CLASSES } from '@/components/shared/prose-classes'

/**
 * Keep class strings literal so Tailwind can discover them.
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

export const H1 = styled('h1', PROSE_CLASSES.h1)
export const H2 = styled('h2', PROSE_CLASSES.h2)
export const H3 = styled('h3', PROSE_CLASSES.h3)
export const P = styled('p', PROSE_CLASSES.p)
export const A = styled('a', PROSE_CLASSES.a)

const MUTED = 'text-sm text-muted-foreground'

export const Muted = styled('p', MUTED)

/**
 * `Muted` where a block element cannot go.
 */
export const MutedText = styled('span', MUTED)
