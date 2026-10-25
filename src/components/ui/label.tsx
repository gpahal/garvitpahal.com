import * as React from 'react'

import { cn } from 'cn'

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    // Not CLI output: the association comes via `htmlFor` or children in `props`, which the rule
    // cannot see.
    // eslint-disable-next-line jsx-a11y-x/label-has-associated-control -- associated through props
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
