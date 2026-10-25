import type { ComponentProps, ReactNode } from 'react'

import type { VariantProps } from 'class-variance-authority'
import { cn } from 'cn'

import { buttonVariants } from '@/components/ui/button-variants'

type ButtonLinkProps = ComponentProps<'a'> &
  VariantProps<typeof buttonVariants> & {
    /**
     * For a file such as a PDF or a feed, which Astro's router would otherwise prefetch and try to
     * swap in.
     */
    isFile?: boolean
  }

/**
 * `cn` is needed: cva keeps the base border and radius beside the variant's, and only `cn` drops the
 * loser.
 */
export function ButtonLink({
  variant,
  size,
  className,
  isFile = false,
  children,
  ...props
}: ButtonLinkProps): ReactNode {
  const fileProps = isFile ? { 'data-astro-reload': true, 'data-astro-prefetch': 'false' } : {}
  return (
    <a className={cn(buttonVariants({ variant, size }), className)} {...fileProps} {...props}>
      {children}
    </a>
  )
}
