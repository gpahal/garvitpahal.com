import type { ComponentProps, ReactNode } from 'react'

import type { ConfirmDelete } from '@/hooks/use-confirm-delete'
import { useDialogWork } from '@/hooks/use-dialog-work'
import type { Submit } from '@/hooks/use-submit'
import { ScrollDialogBody, ScrollDialogContent } from '@/components/shared/scroll-dialog'
import { DialogFooter } from '@/components/ui/dialog'

type DetailDialogContentProps = {
  title: string
  summary: ReactNode
  description: string | undefined
  submit: Submit
  /**
   * Otherwise the footer's leading button, the least likely to be what a tap meant.
   */
  initialFocus: ComponentProps<typeof ScrollDialogContent>['initialFocus']
  confirmDelete: ConfirmDelete
  leading?: ReactNode
  actions: ReactNode
  children?: ReactNode
}

export function DetailDialogContent({
  title,
  summary,
  description,
  submit,
  initialFocus,
  confirmDelete,
  leading = confirmDelete.button,
  actions,
  children,
}: DetailDialogContentProps): ReactNode {
  useDialogWork(false, submit.isPending)
  return (
    <ScrollDialogContent title={title} description={summary} initialFocus={initialFocus}>
      <ScrollDialogBody submit={submit}>
        {description === undefined ? undefined : (
          <p className="whitespace-pre-wrap">{description}</p>
        )}
        {children}
      </ScrollDialogBody>
      {confirmDelete.footer ?? (
        <DialogFooter>
          {leading}
          {actions}
        </DialogFooter>
      )}
    </ScrollDialogContent>
  )
}
