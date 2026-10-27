import type { ReactNode } from 'react'

import { useDialogTarget } from '@/hooks/use-dialog-target'
import { AddButton } from '@/components/shared/add-button'
import { LiveSubjectContent } from '@/components/shared/live-subject-content'

type ManageDialogsOptions<Subject> = {
  useLive: (opened: Subject) => Subject | null | undefined | Error
  goneNotice?: (live: Subject) => string | undefined
  newLabel: string
  renderActions: (subject: Subject, on: { onEdit: () => void; onClose: () => void }) => ReactNode
  renderForm: (subject: Subject | undefined, onClose: () => void) => ReactNode
}

export type ManageDialogs<Subject> = {
  newButton: ReactNode
  open: (subject: Subject) => void
  dialogs: ReactNode
}

export function useManageDialogs<Subject extends { name: string }>({
  useLive,
  goneNotice,
  newLabel,
  renderActions,
  renderForm,
}: ManageDialogsOptions<Subject>): ManageDialogs<Subject> {
  type ManageTarget =
    { kind: 'create' } | { kind: 'open'; subject: Subject } | { kind: 'edit'; subject: Subject }
  const dialog = useDialogTarget<ManageTarget>()
  const { target, show, close, render } = dialog

  return {
    newButton: (
      <AddButton
        label={newLabel}
        onClick={() => {
          show({ kind: 'create' })
        }}
      />
    ),
    open: (opened) => {
      show({ kind: 'open', subject: opened })
    },
    dialogs: render(
      target === undefined ? undefined : target.kind === 'create' ? (
        renderForm(undefined, close)
      ) : (
        <LiveSubjectContent
          dialog={dialog}
          opened={target.subject}
          useLive={useLive}
          goneNotice={goneNotice}
          name={target.subject.name}
        >
          {(subject) =>
            target.kind === 'edit'
              ? renderForm(subject, close)
              : renderActions(subject, {
                  onEdit: () => {
                    show({ kind: 'edit', subject })
                  },
                  onClose: close,
                })
          }
        </LiveSubjectContent>
      ),
    ),
  }
}
