import type { ReactNode } from 'react'

import { cn } from 'cn'
import { CircleCheck, Info, TriangleAlert } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const TONES = {
  error: { variant: 'destructive', Icon: TriangleAlert },
  warning: { variant: 'default', Icon: TriangleAlert },
  info: { variant: 'default', Icon: Info },
  success: { variant: 'default', Icon: CircleCheck },
} as const

type NoticeAlertProps = {
  message?: ReactNode
  description?: ReactNode
  tone?: keyof typeof TONES
  /**
   * `none` for a copy of a message announced elsewhere, or one inside its own live region, so a
   * reader hears it once.
   */
  announce?: 'alert' | 'status' | 'none'
  action?: ReactNode
  /**
   * For a control's `aria-describedby`, so a reader returning to it still finds the message. It
   * goes on the heading, which is what a describing reference should name.
   */
  id?: string
  /**
   * For an alert that stands in for what had focus with no action to take it instead.
   */
  isFocusable?: boolean
  className?: string
}

export function NoticeAlert({
  message,
  description,
  tone = 'error',
  announce = 'alert',
  action,
  id,
  isFocusable = false,
  className,
}: NoticeAlertProps): ReactNode {
  const { variant, Icon } = TONES[tone]
  const alert = (
    <Alert
      variant={variant}
      role={announce === 'none' ? undefined : announce}
      tabIndex={isFocusable ? -1 : undefined}
      className={action === undefined ? className : undefined}
    >
      <Icon strokeWidth={1.5} />
      {message === undefined ? undefined : <AlertTitle id={id}>{message}</AlertTitle>}
      {description === undefined ? undefined : <AlertDescription>{description}</AlertDescription>}
    </Alert>
  )
  return action === undefined ? (
    alert
  ) : (
    <div className={cn('space-y-3', className)}>
      {alert}
      {action}
    </div>
  )
}
