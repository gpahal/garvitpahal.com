import * as React from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/styles'

export const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium border shadow-sm',
  {
    variants: {
      variant: {
        default: 'bg-neutral-4 text-fg border-neutral-7',
        info: 'bg-info-3 text-info-11 border-info-6',
        warn: 'bg-warn-3 text-warn-11 border-warn-6',
        error: 'bg-error-3 text-error-11 border-error-6',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant, ...props }, ref) => {
  return (
    <div
      {...props}
      ref={ref}
      className={cn(
        badgeVariants({ variant }),
        'inline-flex items-center rounded-md border px-2.5 py-[0.275rem] text-[0.8rem]/[0.8rem] font-medium shadow-sm',
        className,
      )}
    />
  )
})
Badge.displayName = 'Badge'
