import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { cn } from 'cn'

import { toggleClass } from '@/components/ui/toggle-variants'

function Toggle({ className, ...props }: TogglePrimitive.Props) {
  return <TogglePrimitive data-slot="toggle" className={cn(toggleClass, className)} {...props} />
}

export { Toggle }
