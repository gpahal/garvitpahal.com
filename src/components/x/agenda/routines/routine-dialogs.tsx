import { api } from '@convex/_generated/api'

import type { Routine } from '@/lib/x/agenda/doc-types'
import { useManageDialogs } from '@/hooks/use-manage-dialogs'
import type { ManageDialogs } from '@/hooks/use-manage-dialogs'

import { useLiveDoc } from '../dialogs/use-live'
import { RoutineActions } from './routine-actions'
import { RoutineForm } from './routine-form'

function useLiveRoutine(opened: Routine): Routine | null | undefined | Error {
  return useLiveDoc(api.routines.get, opened)
}

/**
 * Logging is its own dialog, which `onLog` hands an active routine to.
 */
export function useRoutineDialogs(onLog: (routine: Routine) => void): ManageDialogs<Routine> {
  return useManageDialogs({
    useLive: useLiveRoutine,
    newLabel: 'New routine',
    renderActions: (routine, { onEdit, onClose }) => (
      <RoutineActions
        routine={routine}
        onEdit={onEdit}
        onLog={() => {
          onClose()
          onLog(routine)
        }}
        onClose={onClose}
      />
    ),
    renderForm: (routine, onClose) => <RoutineForm routine={routine} onClose={onClose} />,
  })
}
