import { useMemo } from 'react'
import type { ReactNode } from 'react'

import { useLiveSubject } from '@/hooks/use-dialog-target'
import type { LiveDialog } from '@/hooks/use-dialog-target'
import { DialogReadFailureContext, FormNoticeContext } from '@/components/shared/dialog-contexts'

type LiveSubjectContentProps<Subject> = {
  dialog: LiveDialog
  /**
   * Stands in until the first read lands.
   */
  opened: Subject
  useLive: (opened: Subject) => Subject | null | undefined | Error
  goneNotice?: (live: Subject) => string | undefined
  name: string
  children: (subject: Subject) => ReactNode
}

/**
 * A dialog's content for a subject it reads live. A failed read shows above the content, which
 * stays on the last subject seen, rather than being thrown past the dialog.
 */
export function LiveSubjectContent<Subject>({
  dialog,
  opened,
  useLive,
  goneNotice,
  name,
  children,
}: LiveSubjectContentProps<Subject>): ReactNode {
  const read = useLive(opened)
  const { subject, failure, notice } = useLiveSubject(dialog, read === undefined ? opened : read, {
    goneNotice,
    name: `"${name}"`,
  })
  const readFailure = useMemo(
    () => (failure === undefined ? undefined : { error: failure, hasResult: true }),
    [failure],
  )
  return subject === undefined ? undefined : (
    <DialogReadFailureContext value={readFailure}>
      <FormNoticeContext value={notice}>{children(subject)}</FormNoticeContext>
    </DialogReadFailureContext>
  )
}
