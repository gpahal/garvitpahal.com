import * as React from 'react'

import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { cn } from 'cn'

import { Separator } from '@/components/ui/separator'

function ItemGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="list"
      data-slot="item-group"
      className={cn('group/item-group flex w-full flex-col gap-4', className)}
      {...props}
    />
  )
}

function ItemSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      className={cn('my-2', className)}
      {...props}
    />
  )
}

const itemVariants = cva(
  'group/item flex w-full flex-wrap items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-muted',
  {
    variants: {
      variant: {
        default: 'border-transparent',
        outline: 'border-border',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Item({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'div'> & VariantProps<typeof itemVariants>) {
  // Not CLI output: lifted out of the `useRender` call, which the CLI nests one level deeper than
  // `unicorn/max-nested-calls` allows.
  const mergedProps = mergeProps<'div'>(
    {
      className: cn(itemVariants({ variant, className })),
    },
    props,
  )
  return useRender({
    defaultTagName: 'div',
    props: mergedProps,
    render,
    state: {
      slot: 'item',
      variant,
    },
  })
}

function ItemContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-content"
      className={cn('flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none', className)}
      {...props}
    />
  )
}

function ItemTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-title"
      className={cn(
        'line-clamp-1 flex w-fit items-center gap-2 text-sm/snug font-medium underline-offset-4',
        className,
      )}
      {...props}
    />
  )
}

function ItemDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        'line-clamp-2 text-left text-sm/normal font-normal text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
        className,
      )}
      {...props}
    />
  )
}

function ItemActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="item-actions" className={cn('flex items-center gap-2', className)} {...props} />
  )
}

export { Item, ItemContent, ItemActions, ItemGroup, ItemSeparator, ItemTitle, ItemDescription }
