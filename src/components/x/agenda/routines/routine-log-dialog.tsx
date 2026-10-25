import type { ReactNode } from 'react'

import { dayOfLocal } from '@convex/shared/intervals'

import type { Routine, RoutineLog } from '@/lib/x/agenda/doc-types'
import { dayOfInstant } from '@/lib/x/agenda/time/dates'
import { readDeviceTimeZone } from '@/hooks/use-device-time-zone'
import { useDialogTarget } from '@/hooks/use-dialog-target'

import { LiveLogDialog } from './live-log-dialog'
import type { LogTarget } from './live-log-dialog'

type RoutineLogDialog = {
  /**
   * Dated on the viewed day if it has passed, else today, since a log cannot be dated ahead.
   */
  logRoutine: (routine: Routine, viewedDay?: number) => void
  openLog: (log: RoutineLog, routine: Routine) => void
  dialog: ReactNode
}

/**
 * Every read is the dialog's own subscription, so it opens on any day and routine whatever the
 * screen behind has loaded. `onLogged` hears the day each new or moved log is filed under.
 */
export function useRoutineLogDialog(onLogged?: (day: number) => void): RoutineLogDialog {
  const dialog = useDialogTarget<LogTarget>()
  const { target, show, close, render } = dialog

  return {
    logRoutine: (opened, viewedDay) => {
      // Today as of the click, in the zone the form then opens with (`useFormTimeZone`).
      const today = dayOfInstant(Date.now(), readDeviceTimeZone())
      show({
        routine: opened,
        log: undefined,
        day: viewedDay === undefined ? today : Math.min(viewedDay, today),
        isAwayFromToday: viewedDay !== undefined && viewedDay !== today,
      })
    },
    openLog: (opened, of) => {
      show({
        routine: of,
        log: opened,
        day: dayOfLocal(opened.started.atLocal),
        isAwayFromToday: false,
      })
    },
    dialog: render(
      target === undefined ? undefined : (
        <LiveLogDialog
          dialog={dialog}
          target={target}
          onLogged={onLogged}
          onOpenLog={(other) => {
            show({ ...target, log: other })
          }}
          onClose={close}
        />
      ),
    ),
  }
}
