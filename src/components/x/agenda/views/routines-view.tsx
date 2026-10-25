import type { ReactNode } from 'react'

import { isActive } from '@convex/shared/goalRules'

import type { Routine } from '@/lib/x/agenda/doc-types'
import { EmptyState } from '@/components/shared/empty-state'
import { Loading } from '@/components/shared/loading'

import { useRoutineDialogs } from '../routines/routine-dialogs'
import { RoutineLimitAlert } from '../routines/routine-limit-alert'
import { RoutineList } from '../routines/routine-list'
import { useRoutineLogDialog } from '../routines/routine-log-dialog'
import { useRoutines } from '../routines/use-routines'
import { ManageView } from './manage-view'

export function RoutinesView(): ReactNode {
  const { logRoutine, dialog: logDialog } = useRoutineLogDialog()
  const { newButton: newRoutineButton, open: openRoutine, dialogs } = useRoutineDialogs(logRoutine)
  return (
    <>
      <ManageView newButton={newRoutineButton} subject="your routines">
        <RoutineLists newButton={newRoutineButton} onOpen={openRoutine} />
      </ManageView>
      {dialogs}
      {logDialog}
    </>
  )
}

type RoutineListsProps = {
  newButton: ReactNode
  onOpen: (routine: Routine) => void
}

function RoutineLists({ newButton, onOpen }: RoutineListsProps): ReactNode {
  const routines = useRoutines()
  return (
    <>
      {routines?.length === 0 ? (
        <EmptyState
          title="No routines yet"
          description="Every routine shows up here, active or archived"
          action={newButton}
        />
      ) : undefined}
      <RoutineLimitAlert />
      {routines === undefined ? (
        <Loading />
      ) : (
        <>
          <RoutineList
            title="Active"
            routines={routines.filter((routine) => isActive(routine))}
            onOpen={onOpen}
          />
          <RoutineList
            title="Archived"
            routines={routines.filter((routine) => !isActive(routine))}
            onOpen={onOpen}
          />
        </>
      )}
    </>
  )
}
