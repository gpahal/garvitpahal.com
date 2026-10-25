import type { ReactNode } from 'react'

import { AGENDA_PATHS } from '@/lib/x/agenda/routes'
import { ButtonLink } from '@/components/shared/button-link'

import { ListsBoundary } from '../lists/lists-boundary'

type ManageViewProps = {
  newButton: ReactNode
  subject: string
  children: ReactNode
}

/**
 * The header sits above the lists' boundary, so a failed read keeps Back and New.
 */
export function ManageView({ newButton, subject, children }: ManageViewProps): ReactNode {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-2">
        <ButtonLink href={AGENDA_PATHS.agenda} variant="outline">
          Back to Agenda
        </ButtonLink>
        {newButton}
      </div>
      <ListsBoundary subject={subject}>{children}</ListsBoundary>
    </div>
  )
}
