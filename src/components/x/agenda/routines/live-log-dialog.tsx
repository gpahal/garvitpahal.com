import { useMemo } from 'react'
import type { ReactNode } from 'react'

import type { FunctionReturnType } from 'convex/server'

import { api } from '@convex/_generated/api'
import { isActive } from '@convex/shared/goalRules'
import { intervalOfDay, isInRange } from '@convex/shared/intervals'
import { toLocal } from '@convex/shared/localTime'

import type { Routine, RoutineLog } from '@/lib/x/agenda/doc-types'
import { goalSummary, progressLabel } from '@/lib/x/agenda/routines/routine-format'
import { routineStatusOf } from '@/lib/x/agenda/routines/schedule'
import { useDeviceTimeZone } from '@/hooks/use-device-time-zone'
import { useLiveSubject } from '@/hooks/use-dialog-target'
import type { LiveDialog } from '@/hooks/use-dialog-target'
import { useNow } from '@/hooks/use-now'
import { DialogReadFailureContext, FormNoticeContext } from '@/components/shared/dialog-contexts'
import { Loading } from '@/components/shared/loading'
import { ScrollDialogBody, ScrollDialogContent } from '@/components/shared/scroll-dialog'

import { useDialogQuery } from '../dialogs/use-live'
import { LogForm } from './log-form'
import type { LogFormRead } from './log-form'

/**
 * The day is fixed on open and picks the interval measured, so a dialog left open past midnight
 * keeps its logs and draft. `isAwayFromToday` means the screen behind showed another day, so where a
 * new log lands needs saying.
 */
export type LogTarget = {
  routine: Routine
  log: RoutineLog | undefined
  day: number
  isAwayFromToday: boolean
}

type LiveLogDialogProps = {
  dialog: LiveDialog
  target: LogTarget
  onLogged: ((day: number) => void) | undefined
  onOpenLog: (log: RoutineLog) => void
  onClose: () => void
}

export function LiveLogDialog({ dialog, target, ...form }: LiveLogDialogProps): ReactNode {
  const { routine, day, log } = target
  const routineName = `"${routine.name}"`
  const logName = `A log of ${routineName}`
  const read = useDialogQuery(
    api.routineLogs.forDialog,
    log === undefined
      ? { routineId: routine._id, day }
      : { routineId: routine._id, day, logId: log._id },
  )
  const { subject, failure, notice } = useLiveSubject(dialog, isDeletion(read) ? null : read, {
    // An archived routine takes no new logs, but the ones it has can still be corrected.
    goneNotice: (live) =>
      log !== undefined || isActive(live.routine)
        ? undefined
        : `${routineName} was archived elsewhere, so it takes no new logs`,
    name: (isDeletion(read) ? read.gone === 'log' : log !== undefined) ? logName : routineName,
    // What the form was filled from: the log it corrects, or for a new log the goal.
    formFields: (live) => (log === undefined ? live.routine.goal : live.log),
  })
  const hasResult = subject !== undefined
  const readFailure = useMemo(
    () => (failure === undefined ? undefined : { error: failure, hasResult }),
    [failure, hasResult],
  )
  return (
    <DialogReadFailureContext value={readFailure}>
      <FormNoticeContext value={notice}>
        <LogDialogContent
          routine={subject?.routine ?? routine}
          read={subject}
          hasFailed={failure !== undefined}
          day={day}
          isAwayFromToday={target.isAwayFromToday}
          {...form}
        />
      </FormNoticeContext>
    </DialogReadFailureContext>
  )
}

type DialogRead = FunctionReturnType<typeof api.routineLogs.forDialog>

function isDeletion(
  read: DialogRead | undefined | Error,
): read is Extract<DialogRead, { gone: unknown }> {
  return read !== undefined && !(read instanceof Error) && 'gone' in read
}

type LogDialogContentProps = {
  /**
   * The routine as last read, or as opened until the first read lands.
   */
  routine: Routine
  /**
   * The interval's logs and the log being corrected, or `undefined` while they load.
   */
  read: LogFormRead | undefined
  hasFailed: boolean
  day: number
  isAwayFromToday: boolean
  onLogged: ((day: number) => void) | undefined
  onOpenLog: (log: RoutineLog) => void
  onClose: () => void
}

/**
 * One shell, header and all, so filling it in swaps only the body and never remounts the popup.
 */
function LogDialogContent({
  routine,
  read,
  hasFailed,
  day,
  ...form
}: LogDialogContentProps): ReactNode {
  const now = useNow()
  const timeZone = useDeviceTimeZone()
  // Measured against the goal the logs were read with, which is `routine` once they have landed.
  const status =
    read &&
    routineStatusOf(
      read.routine,
      read.totals,
      intervalOfDay(read.routine.goal.kind, day),
      now,
      timeZone,
    )
  const isCurrent = status !== undefined && isInRange(status.interval, toLocal(now, timeZone))
  // A failed read takes the body's place, and nothing is loading any more.
  const loading = hasFailed ? undefined : <Loading inline />

  return (
    <ScrollDialogContent
      title={routine.name}
      description={
        status === undefined
          ? loading
          : `${goalSummary(routine.goal)} · ${progressLabel(routine.goal, status, { isCurrent })}`
      }
    >
      {/* The header says it is loading; the body stays empty unless an outage needs saying. */}
      {read === undefined || status === undefined ? (
        <ScrollDialogBody showsNotice />
      ) : (
        <LogForm read={read} status={status} isCurrent={isCurrent} now={now} day={day} {...form} />
      )}
    </ScrollDialogContent>
  )
}
