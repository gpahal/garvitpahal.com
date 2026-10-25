import type { ComponentProps, ReactNode } from 'react'

import { cn } from 'cn'

import { capitalize } from '@/lib/text'
import type { Submit } from '@/hooks/use-submit'
import { Button } from '@/components/ui/button'

type PendingButtonProps = ComponentProps<typeof Button> & {
  /**
   * This button's own write. Another write that only blocks it goes in `disabled`.
   */
  isPending: boolean
  pendingLabel: string
}

/**
 * A button that says so while its write is in flight, keeping the width of the longer label. It
 * stays focusable while pending, since a natively disabled button drops focus and a screen reader
 * would not hear the new label; Base UI still refuses clicks and submission.
 */
export function PendingButton({
  isPending,
  pendingLabel,
  disabled,
  focusableWhenDisabled,
  children,
  ...button
}: PendingButtonProps): ReactNode {
  return (
    <Button
      {...button}
      disabled={disabled === true || isPending}
      focusableWhenDisabled={isPending || focusableWhenDisabled}
      aria-busy={isPending || undefined}
    >
      <span className="grid justify-items-center">
        <span className={cn('col-start-1 row-start-1', isPending && 'invisible')}>{children}</span>
        <span className={cn('col-start-1 row-start-1', !isPending && 'invisible')}>
          {pendingLabel}
        </span>
      </span>
    </Button>
  )
}

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, 'onClick' | 'disabled'> & {
  submit: Submit
  /**
   * Lowercase, as `useSubmit` takes it; capitalised, it is the pending label.
   */
  doing: string
  /**
   * Called at the tap, so anything it reads, such as the clock, is read then.
   */
  action: () => Promise<unknown>
  onSuccess?: () => void
}

/**
 * Any write in flight disables it, and only its own says so.
 */
export function SubmitButton({
  submit,
  doing,
  action,
  onSuccess,
  ...button
}: SubmitButtonProps): ReactNode {
  return (
    <PendingButton
      {...button}
      disabled={submit.isPending}
      isPending={submit.pendingDoing === doing}
      pendingLabel={`${capitalize(doing)}…`}
      onClick={() => {
        submit.run(action, { onSuccess, doing })
      }}
    />
  )
}
