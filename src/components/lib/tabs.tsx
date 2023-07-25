import * as React from 'react'

import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/styles'

export type TabsProps = TabsPrimitive.TabsProps

export const Tabs = TabsPrimitive.Root

export type TabsListProps = TabsPrimitive.TabsListProps

export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      {...props}
      ref={ref}
      className={cn(
        'inline-flex h-9 w-full items-center justify-start border-b bg-transparent text-fg-subtle',
        className,
      )}
    />
  ),
)
TabsList.displayName = TabsPrimitive.List.displayName

export type TabsTriggerProps = TabsPrimitive.TabsTriggerProps

export const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, TabsTriggerProps>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      {...props}
      ref={ref}
      className={cn(
        'relative inline-flex h-9 items-center justify-center whitespace-nowrap rounded-none border-b-2 border-b-transparent bg-transparent px-3 pb-2.5 pt-2 text-base font-medium text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-10 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-b-fg data-[state=active]:text-fg',
        className,
      )}
    />
  ),
)
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

export type TabsContentProps = TabsPrimitive.TabsContentProps

export const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, TabsContentProps>(
  (props, ref) => <TabsPrimitive.Content {...props} ref={ref} />,
)
TabsContent.displayName = TabsPrimitive.Content.displayName
