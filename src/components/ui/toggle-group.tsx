'use client'

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group'
import { cn } from 'cn'

import { toggleClass } from '@/components/ui/toggle-variants'

function ToggleGroup({ className, ...props }: ToggleGroupPrimitive.Props) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn(
        'group/toggle-group flex w-fit flex-row items-center gap-1 rounded-[min(var(--radius-md),10px)]',
        className,
      )}
      {...props}
    />
  )
}

function ToggleGroupItem({ className, ...props }: TogglePrimitive.Props) {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn('shrink-0 focus:z-10 focus-visible:z-10', toggleClass, className)}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
