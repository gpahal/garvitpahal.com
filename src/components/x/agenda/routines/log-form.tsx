import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'

import { api } from '@convex/_generated/api'
import { dayOfLocal } from '@convex/shared/intervals'
import { EARLIEST_LOCAL, INTERVAL_LOGS_READ, MAX_NOTE_LENGTH } from '@convex/shared/limits'
import { toLocal } from '@convex/shared/localTime'

import { ifChanged } from '@/lib/form-fields'
import type { RoutineLog } from '@/lib/x/agenda/doc-types'
import {
  comparableDuration,
  durationBoxesOf,
  durationUnitsOf,
  parseDuration,
} from '@/lib/x/agenda/routines/duration-boxes'
import type { DurationBoxes } from '@/lib/x/agenda/routines/duration-boxes'
import { parseLogDraft } from '@/lib/x/agenda/routines/log-draft'
import { defaultLogMinutes, defaultLogStart } from '@/lib/x/agenda/routines/log-start'
import { intervalWords, minutesLabel, wholeMinutes } from '@/lib/x/agenda/routines/routine-format'
import type { RoutineStatus } from '@/lib/x/agenda/routines/schedule'
import {
  formatLocalDateTime,
  localToDateTimeInput,
  toDateTimeInput,
} from '@/lib/x/agenda/time/dates'
import { zoneLabel } from '@/lib/x/agenda/time/zone-label'
import { useConfirmDelete } from '@/hooks/use-confirm-delete'
import { useDeviceTimeZone } from '@/hooks/use-device-time-zone'
import { useSubmit } from '@/hooks/use-submit'
import { FormDialogRows } from '@/components/shared/form-dialog-content'
import { OpenRow, RowTime } from '@/components/shared/open-row'
import { RowSection } from '@/components/shared/row-section'
import { OptionalTextField } from '@/components/shared/text-fields'
import { Muted } from '@/components/shared/typography'
import { FieldGroup } from '@/components/ui/field'

import { useFormTimeZone, useZonedDateTimeInput } from '../dialogs/use-zoned-date-time-input'
import { ZonedDateTimeField } from '../dialogs/zoned-date-time-field'
import { DurationField } from './duration-field'
import { RoutineProgress } from './routine-progress'

export type LogFormRead = Exclude<
  FunctionReturnType<typeof api.routineLogs.forDialog>,
  { gone: unknown }
>

type LogFormProps = {
  read: LogFormRead
  /**
   * The form keeps the interval it opened with for its defaults.
   */
  status: RoutineStatus
  /**
   * The day a new log is filed under until its start says otherwise.
   */
  day: number
  isAwayFromToday: boolean
  isCurrent: boolean
  now: number
  onLogged: ((day: number) => void) | undefined
  onOpenLog: (log: RoutineLog) => void
  onClose: () => void
}

/**
 * The fields keep the goal, log and day the form opened with (`useLiveSubject`); the progress and
 * rows follow the live interval.
 */
export function LogForm({
  read,
  status,
  day,
  isAwayFromToday,
  isCurrent,
  now,
  onLogged,
  onOpenLog,
  onClose,
}: LogFormProps): ReactNode {
  const { routine, rows: logs, hasMore: hasMoreRows } = read
  const zone = useFormTimeZone()
  const deviceZone = useDeviceTimeZone()
  const create = useMutation(api.routineLogs.create)
  const update = useMutation(api.routineLogs.update)
  const remove = useMutation(api.routineLogs.remove)
  const submit = useSubmit()
  // Kept from opening, so a goal changed elsewhere cannot drop a box from a draft; the server judges
  // the save by the goal it has then.
  const [initial] = useState(() => {
    const { kind, minutesEach } = routine.goal
    const { interval } = status
    return {
      interval,
      kind,
      minutesEach,
      log: read.log,
      duration: durationBoxesOf(
        kind,
        minutesEach === undefined
          ? undefined
          : defaultLogMinutes(day, interval, minutesEach, now, zone),
      ),
      note: read.log?.note ?? '',
      now,
    }
  })
  const { kind, minutesEach, log } = initial
  // Except: a goal that gains a duration while a new log is open adds blank boxes, since the server
  // refuses a new log without one. Once shown they stay.
  const [hasGainedDuration, setHasGainedDuration] = useState(false)
  if (!log && !hasGainedDuration && routine.goal.minutesEach !== undefined) {
    setHasGainedDuration(true)
  }
  const hasDurationField = minutesEach !== undefined || hasGainedDuration
  // As the start input works (`useZonedDateTimeInput`): once typed back to exactly what they were
  // filled from, the boxes count as untouched, and a save keeps the stored length.
  const [typedDuration, setTypedDuration] = useState<DurationBoxes>()
  const untouchedDuration = log ? durationBoxesOf(kind, wholeMinutes(log)) : initial.duration
  const duration = typedDuration ?? untouchedDuration
  const setDuration = (boxes: DurationBoxes): void => {
    const isSource = durationUnitsOf(kind).every((unit) => boxes[unit] === untouchedDuration[unit])
    setTypedDuration(isSource ? undefined : boxes)
  }
  const [note, setNote] = useState(initial.note)
  // Blank boxes are a log with no length, as zeros are.
  const isDurationUntouched =
    comparableDuration(kind, duration, 'zero') ===
    comparableDuration(kind, untouchedDuration, 'zero')

  // A new log is assumed to end as the dialog opened, so an untyped start follows the duration:
  // 2 hours typed means it began two hours ago.
  const untouchedAt = log
    ? log.started.at
    : defaultLogStart(
        day,
        initial.interval,
        parseDuration(kind, duration).minutes ?? minutesEach,
        // The opening minute, not the live one: the input must not change while it is read, and
        // past midnight a live clock would work the default out against the wrong day.
        initial.now,
        zone,
      )
  const start = useZonedDateTimeInput(zone, {
    at: untouchedAt,
    // A stored start shows the reading it was recorded with, which is the day it is filed under.
    input: log ? localToDateTimeInput(log.started.atLocal) : toDateTimeInput(untouchedAt, zone),
  })
  const { keptStart, startError, durationError, durationBoxErrors, fields, changedLengthMs } =
    parseLogDraft({
      log,
      kind,
      hasDurationField,
      startedAt: start.at,
      isStartUntouched: start.isUntouched,
      duration,
      isDurationUntouched,
      zone,
      now,
    })
  // A changed start is read in the form's zone, so say so before a keystroke moves the instant.
  // Names are compared, so an alias such as `Asia/Calcutta` warns needlessly.
  const zoneNote =
    keptStart && keptStart.timeZone !== zone
      ? `This log was recorded in ${zoneLabel(keptStart.timeZone, now)}. A changed time is read in ${zoneLabel(zone, now)} instead`
      : `Times are in ${zoneLabel(keptStart ? keptStart.timeZone : zone, now)}`
  const confirmDelete = useConfirmDelete({
    question: 'Delete this log for good?',
    submit,
    remove: async () => {
      if (log) {
        await remove({ id: log._id })
      }
    },
    onDeleted: onClose,
  })

  const isInvalid = fields === undefined

  const save = (): void => {
    if (isInvalid) {
      return
    }
    const { started, timeZone } = fields
    submit.run(
      async () =>
        log
          ? update({
              id: log._id,
              reading: keptStart ? undefined : { started, timeZone },
              lengthMs: changedLengthMs,
              note: ifChanged(initial.note, note),
            })
          : create({ routineId: routine._id, ...fields, note }),
      {
        onSuccess: () => {
          const loggedDay = dayOfLocal(started.atLocal)
          if (!log || loggedDay !== dayOfLocal(log.started.atLocal)) {
            onLogged?.(loggedDay)
          }
          onClose()
        },
        doing: log ? 'saving' : 'logging',
      },
    )
  }

  // Base UI places focus once, on open; while the logs load it lands on Close or the popup and stays
  // there. Focus the owner has moved is left alone.
  const startRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const input = startRef.current
    const popup = input?.closest('[role="dialog"]')
    const active = document.activeElement
    if (
      popup != null &&
      (active === popup || popup.querySelector(':scope > [data-slot="dialog-close"]') === active)
    ) {
      input?.focus()
    }
  }, [])

  const startLabel = hasDurationField ? 'Started' : 'When'
  const otherLogs = logs.filter((candidate) => candidate._id !== log?._id)
  const nowLocal = toLocal(now, deviceZone)
  const inInterval = intervalWords(routine.goal.kind, isCurrent)

  return (
    <FormDialogRows
      submit={submit}
      isInvalid={isInvalid}
      isDirty={!isDurationUntouched || note !== initial.note || !start.isUntouched}
      submitLabel={log ? 'Save log' : 'Log'}
      pendingLabel={log ? 'Saving…' : 'Logging…'}
      leading={log ? confirmDelete.button : undefined}
      footer={confirmDelete.footer}
      onSubmit={save}
    >
      {/* An empty or full bar reads as a second rule under the header; the text has the number. */}
      {status.completed > 0 && status.completed < routine.goal.count ? (
        <RoutineProgress tracked={{ routine, status }} isCurrent={isCurrent} />
      ) : undefined}
      {hasMoreRows ? (
        <Muted>
          Only the latest {INTERVAL_LOGS_READ} logs {inInterval} are listed
        </Muted>
      ) : undefined}
      {/* A day ahead logs on today and a past log can move, so it may land on another day. */}
      {isAwayFromToday && !log ? (
        <Muted>
          This log goes on the day in the "{startLabel}" field, whichever day you opened it from
        </Muted>
      ) : undefined}
      <FieldGroup>
        <ZonedDateTimeField
          ref={startRef}
          label={startLabel}
          time={start}
          error={startError}
          now={now}
          zoneNote={zoneNote}
          min={localToDateTimeInput(EARLIEST_LOCAL)}
          max={toDateTimeInput(now, zone)}
        />
        {hasDurationField ? (
          <DurationField
            label="Duration"
            kind={kind}
            value={duration}
            boxErrors={durationBoxErrors}
            error={durationError}
            onChange={setDuration}
          />
        ) : undefined}
        <OptionalTextField
          label="Note"
          value={note}
          rows={2}
          maxLength={MAX_NOTE_LENGTH}
          onChange={setNote}
        />
      </FieldGroup>
      {otherLogs.length === 0 ? undefined : (
        <RowSection title={`${log ? 'Other logs' : 'Logged'} ${inInterval}`} level="h3">
          {otherLogs.map((other) => (
            <li key={other._id}>
              <OpenRow
                title={formatLocalDateTime(other.started.atLocal, nowLocal)}
                aside={
                  routine.goal.minutesEach === undefined ? undefined : (
                    <RowTime>{minutesLabel(other)}</RowTime>
                  )
                }
                onOpen={() => {
                  onOpenLog(other)
                }}
              />
            </li>
          ))}
        </RowSection>
      )}
    </FormDialogRows>
  )
}
