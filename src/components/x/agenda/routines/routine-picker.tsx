import type { ReactNode } from 'react'

import { isActive } from '@convex/shared/goalRules'

import type { Routine } from '@/lib/x/agenda/doc-types'
import { AGENDA_PATHS } from '@/lib/x/agenda/routes'
import { ButtonLink } from '@/components/shared/button-link'
import { Loading } from '@/components/shared/loading'
import { ScrollDialog, ScrollDialogBody } from '@/components/shared/scroll-dialog'

import { RoutineList } from './routine-list'
import { useRoutines } from './use-routines'

type RoutinePickerProps = {
  isOpen: boolean
  onPick: (routine: Routine) => void
  onClose: () => void
}

export function RoutinePicker({ isOpen, onPick, onClose }: RoutinePickerProps): ReactNode {
  return (
    <ScrollDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Log a routine"
      description="Choose the routine to log for this day"
    >
      <ActiveRoutines onPick={onPick} />
    </ScrollDialog>
  )
}

/**
 * Its own component so the routines are read inside the dialog, where a failed read costs only the
 * dialog, and only while it is open.
 */
function ActiveRoutines({ onPick }: Pick<RoutinePickerProps, 'onPick'>): ReactNode {
  const routines = useRoutines()?.filter((routine) => isActive(routine))
  return (
    <ScrollDialogBody showsNotice={routines === undefined}>
      {routines === undefined ? (
        <Loading />
      ) : routines.length === 0 ? (
        <>
          <p className="text-muted-foreground">There are no active routines to log</p>
          <ButtonLink href={AGENDA_PATHS.routines} variant="outline" className="self-start">
            Manage routines
          </ButtonLink>
        </>
      ) : (
        <RoutineList routines={routines} onOpen={onPick} />
      )}
    </ScrollDialogBody>
  )
}
