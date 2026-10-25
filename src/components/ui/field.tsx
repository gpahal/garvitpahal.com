import { cn } from 'cn'

import { Label } from '@/components/ui/label'

function FieldSet({ className, ...props }: React.ComponentProps<'fieldset'>) {
  return (
    <fieldset data-slot="field-set" className={cn('flex flex-col gap-4', className)} {...props} />
  )
}

function FieldLegend({ className, ...props }: React.ComponentProps<'legend'>) {
  return (
    <legend
      data-slot="field-legend"
      className={cn('mb-1.5 text-sm font-medium', className)}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-group"
      className={cn('flex w-full flex-col gap-5 *:data-[slot=field-group]:gap-4', className)}
      {...props}
    />
  )
}

function Field({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="group"
      data-slot="field"
      className={cn(
        'group/field flex w-full flex-col gap-2 *:w-full data-[invalid=true]:text-destructive [&>.sr-only]:w-auto',
        className,
      )}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        'group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        'text-left text-sm/normal font-normal text-muted-foreground',
        'last:mt-0 nth-last-2:-mt-1',
        '[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
        className,
      )}
      {...props}
    />
  )
}

function FieldError({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & { children?: string }) {
  return children === undefined || children === '' ? null : (
    <div
      role="alert"
      data-slot="field-error"
      className={cn('text-sm font-normal text-destructive', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Field, FieldLabel, FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSet }
