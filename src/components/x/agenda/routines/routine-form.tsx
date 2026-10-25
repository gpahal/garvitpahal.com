import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useMutation } from 'convex/react'
import { X } from 'lucide-react'

import { api } from '@convex/_generated/api'
import { INTERVAL_KINDS, INTERVAL_UNITS } from '@convex/shared/goalRules'
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from '@convex/shared/limits'

import { ifChanged } from '@/lib/form-fields'
import { MONTHS } from '@/lib/months'
import type { Routine } from '@/lib/x/agenda/doc-types'
import {
  addedReminder,
  areRoutineDraftsDifferent,
  dayChoices,
  dayLengthOf,
  draftOf,
  FIELDS_LEFT_TO_CHOOSE,
  isIntervalKind,
  parseDraft,
  withFittedDays,
  withKind,
} from '@/lib/x/agenda/routines/routine-draft'
import type {
  ReminderDraft,
  ReminderError,
  RoutineDraft,
} from '@/lib/x/agenda/routines/routine-draft'
import { dayLabel } from '@/lib/x/agenda/routines/routine-format'
import { WEEKDAYS } from '@/lib/x/agenda/time/dates'
import { useErrorOnceTouched } from '@/hooks/use-error-once-touched'
import { useSubmit } from '@/hooks/use-submit'
import { AddButton } from '@/components/shared/add-button'
import { FieldStatus } from '@/components/shared/field-status'
import { FormDialogContent } from '@/components/shared/form-dialog-content'
import { focusNeighbourOf } from '@/components/shared/refocus-on-removal'
import {
  OptionalMark,
  OptionalTextField,
  RequiredTextField,
  WholeNumberField,
} from '@/components/shared/text-fields'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select'

import { DurationField } from './duration-field'
import { RoutineLimitAlert } from './routine-limit-alert'

type RoutineFormProps = {
  routine: Routine | undefined
  onClose: () => void
}

export function RoutineForm({ routine, onClose }: RoutineFormProps): ReactNode {
  const id = useId()
  const create = useMutation(api.routines.create)
  const update = useMutation(api.routines.update)
  const submit = useSubmit()
  // The goal is one field, as it is one value in the schema, compared as what it would save.
  const [initial] = useState(() => {
    const opened = draftOf(routine)
    return { draft: opened, goal: JSON.stringify(parseDraft(opened).goal) }
  })
  const [draft, setDraft] = useState(initial.draft)
  const reminderRowsRef = useRef<HTMLUListElement | null>(null)
  const reminderAdderRef = useRef<HTMLButtonElement | null>(null)
  // The row "Add reminder" last appended, whose blank field takes focus as it mounts.
  const [addedId, setAddedId] = useState<string>()

  const { errors, goal } = parseDraft(draft)
  const { kind } = draft

  const change = (fields: Partial<RoutineDraft>): void => {
    setDraft((current) => withFittedDays({ ...current, ...fields }))
  }
  const changeReminder = (reminderId: string, fields: Partial<ReminderDraft>): void => {
    setDraft((current) =>
      withFittedDays({
        ...current,
        reminders: current.reminders.map((reminder) =>
          reminder.id === reminderId ? { ...reminder, ...fields } : reminder,
        ),
      }),
    )
  }

  const removeReminder = (index: number, reminderId: string): void => {
    // To the next row's Remove, else the previous row's, else Add.
    focusNeighbourOf(reminderRowsRef.current, index, 'button', reminderAdderRef.current)
    setDraft((current) =>
      withFittedDays({
        ...current,
        reminders: current.reminders.filter((reminder) => reminder.id !== reminderId),
      }),
    )
  }

  const isInvalid = goal === undefined || errors.name !== undefined

  const save = (): void => {
    if (isInvalid) {
      return
    }
    const { name, description } = draft
    submit.run(
      async () =>
        routine
          ? update({
              id: routine._id,
              name: ifChanged(initial.draft.name, name),
              description: ifChanged(initial.draft.description, description),
              goal: JSON.stringify(goal) === initial.goal ? undefined : goal,
            })
          : create({ name, description, goal }),
      { onSuccess: onClose },
    )
  }

  return (
    <FormDialogContent
      title={routine ? 'Edit routine' : 'New routine'}
      submit={submit}
      isDirty={areRoutineDraftsDifferent(initial.draft, draft)}
      isInvalid={isInvalid}
      submitDescribedBy={`${id}-goal-error`}
      onSubmit={save}
    >
      {routine === undefined ? <RoutineLimitAlert /> : undefined}
      <FieldGroup>
        <RequiredTextField
          label="Name"
          maxLength={MAX_NAME_LENGTH}
          value={draft.name}
          error={errors.name}
          onChange={(name) => {
            change({ name })
          }}
        />
        <OptionalTextField
          label="Description"
          value={draft.description}
          rows={2}
          maxLength={MAX_DESCRIPTION_LENGTH}
          onChange={(description) => {
            change({ description })
          }}
        />
        <WholeNumberField
          label="Times"
          min={1}
          value={draft.count}
          error={errors.count}
          beside={
            <Field>
              <FieldLabel htmlFor={`${id}-kind`}>Every</FieldLabel>
              <NativeSelect
                id={`${id}-kind`}
                value={kind}
                onChange={(event) => {
                  const next = event.target.value
                  if (isIntervalKind(next)) {
                    setDraft((current) => withFittedDays(withKind(current, next)))
                  }
                }}
              >
                {INTERVAL_KINDS.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {INTERVAL_UNITS[option]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          }
          onChange={(count) => {
            change({ count })
          }}
        />
        <DurationField
          label={
            <>
              Duration each <OptionalMark />
            </>
          }
          help="With a duration, logs add up: three sessions of 10 mins make one of 30 mins"
          kind={kind}
          value={draft.duration}
          boxErrors={errors.durationBoxes}
          error={errors.duration}
          onChange={(duration) => {
            change({ duration })
          }}
        />
        <FieldSet aria-describedby={`${id}-reminders-help ${id}-reminders-error`}>
          <FieldLegend>Reminders</FieldLegend>
          <FieldDescription id={`${id}-reminders-help`}>
            Reminders only nudge you: a log at any time in the {INTERVAL_UNITS[kind]} counts
            {kind === 'monthly' || kind === 'yearly'
              ? '. A day can count back from the end of the month. A month without that day skips the reminder'
              : undefined}
          </FieldDescription>
          <ul ref={reminderRowsRef} className="flex flex-col gap-2">
            {draft.reminders.map((reminder, index) => (
              <ReminderRow
                key={reminder.id}
                id={`${id}-reminder-${reminder.id}`}
                label={`Reminder ${index + 1}`}
                kind={kind}
                reminder={reminder}
                isFocusedOnMount={reminder.id === addedId}
                error={errors.reminderRows[reminder.id]}
                onChange={(fields) => {
                  changeReminder(reminder.id, fields)
                }}
                onRemove={() => {
                  removeReminder(index, reminder.id)
                }}
              />
            ))}
          </ul>
          <FieldStatus id={`${id}-reminders-error`} className="empty:-mt-3">
            {errors.reminders}
          </FieldStatus>
          <AddButton
            ref={reminderAdderRef}
            // Too few reminders has no input to mark, so a blocked Save focuses this instead.
            data-blocks-save={errors.reminders !== undefined}
            label="Add reminder"
            variant="outline"
            className="self-start"
            onClick={() => {
              // The id is chosen here so the updater stays pure when React runs it twice.
              const addedRowId = crypto.randomUUID()
              setAddedId(addedRowId)
              setDraft((current) =>
                withFittedDays({
                  ...current,
                  reminders: [...current.reminders, addedReminder(current, addedRowId)],
                }),
              )
            }}
          />
        </FieldSet>
      </FieldGroup>
      {/* Shown at once, as the reminders' own message is: it names no input to touch first. */}
      <FieldStatus id={`${id}-goal-error`} className="empty:-mt-5">
        {errors.goal}
      </FieldStatus>
    </FormDialogContent>
  )
}

type FocusRef = ((input: HTMLElement | null) => void) | undefined

type ReminderRowProps = {
  id: string
  label: string
  kind: RoutineDraft['kind']
  reminder: ReminderDraft
  isFocusedOnMount: boolean
  error: ReminderError | undefined
  onChange: (fields: Partial<ReminderDraft>) => void
  onRemove: () => void
}

/**
 * Only the fields the interval gives meaning to, which is the editor's half of what the goal union
 * guarantees in storage.
 */
function ReminderRow({
  id,
  label,
  kind,
  reminder,
  isFocusedOnMount,
  error,
  onChange,
  onRemove,
}: ReminderRowProps): ReactNode {
  // A blank field in a just-added row is not a mistake yet: it shows once left, or on Save.
  const [isBlankAtFirst] = useState(
    [reminder.weekday, reminder.month, reminder.day, reminder.time].includes(''),
  )
  const { shownError, touch } = useErrorOnceTouched(error, !isBlankAtFirst)
  const change = (fields: Partial<ReminderDraft>): void => {
    onChange(fields)
    touch()
  }
  const days = dayChoices(dayLengthOf(kind, reminder.month))
  // An added row's first blank field, or a default row's time, takes focus once. Fixed on mount, so
  // filling it never moves focus on, and a remount on an interval change leaves focus be.
  const [focusedField] = useState(() =>
    isFocusedOnMount
      ? (FIELDS_LEFT_TO_CHOOSE[kind].find((field) => reminder[field] === '') ?? 'time')
      : undefined,
  )
  const [focusOnce] = useState(() => {
    let hasFocused = false
    return (input: HTMLElement | null): void => {
      if (input === null || hasFocused) {
        return
      }

      hasFocused = true
      input.focus()
    }
  })
  const focusRef = (field: ReminderError['field']): FocusRef =>
    field === focusedField ? focusOnce : undefined
  return (
    <li className="flex flex-col gap-1">
      {/* Wraps rather than shrinks, which on a phone would squeeze a yearly row's time to its icon. */}
      <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
        {kind === 'weekly' ? (
          <NameSelect
            ref={focusRef('weekday')}
            label="Weekday"
            blankLabel="Choose a day"
            names={WEEKDAYS}
            value={reminder.weekday}
            isInvalid={shownError?.field === 'weekday'}
            errorId={`${id}-error`}
            onChange={(weekday) => {
              change({ weekday })
            }}
            onBlur={touch}
          />
        ) : undefined}
        {kind === 'yearly' ? (
          <NameSelect
            ref={focusRef('month')}
            label="Month"
            blankLabel="Choose a month"
            names={MONTHS}
            value={reminder.month}
            isInvalid={shownError?.field === 'month'}
            errorId={`${id}-error`}
            onChange={(month) => {
              change({ month })
            }}
            onBlur={touch}
          />
        ) : undefined}
        {kind === 'monthly' || kind === 'yearly' ? (
          // A select, so a day the month lacks, zero or a fraction cannot be entered at all.
          <NativeSelect
            ref={focusRef('day')}
            aria-label="Day"
            aria-invalid={shownError?.field === 'day'}
            aria-describedby={`${id}-error`}
            value={reminder.day}
            onChange={(event) => {
              change({ day: event.target.value })
            }}
            onBlur={touch}
          >
            <BlankOption value={reminder.day} label="Choose a day" />
            {(
              [
                ['From the start', days.fromStart],
                ['From the end', days.fromEnd],
              ] as const
            ).map(([label, group]) => (
              <NativeSelectOptGroup key={label} label={label}>
                {group.map((day) => (
                  <NativeSelectOption key={day} value={String(day)}>
                    {dayLabel(day)}
                  </NativeSelectOption>
                ))}
              </NativeSelectOptGroup>
            ))}
          </NativeSelect>
        ) : undefined}
        <Input
          ref={focusRef('time')}
          type="time"
          required
          // The floor is what makes the row wrap: a time narrower than this hides its own value.
          className="min-w-32 flex-1"
          aria-label="Time"
          aria-invalid={shownError?.field === 'time'}
          aria-describedby={`${id}-error`}
          value={reminder.time}
          onChange={(event) => {
            change({ time: event.target.value })
          }}
          onBlur={touch}
        />
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label={`Remove ${label.toLowerCase()}`}
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
      <FieldStatus id={`${id}-error`} className="empty:-mt-1">
        {shownError?.message}
      </FieldStatus>
    </li>
  )
}

/**
 * Shown while `value` is blank, so the select does not show its first choice as chosen. It cannot
 * be picked back once another is.
 */
function BlankOption({ value, label }: { value: string; label: string }): ReactNode {
  return value === '' ? (
    <NativeSelectOption value="" disabled>
      {label}
    </NativeSelectOption>
  ) : undefined
}

type NameSelectProps = {
  ref: FocusRef
  label: string
  /**
   * What the select shows while no name is chosen.
   */
  blankLabel: string
  names: Array<string>
  /**
   * The name's place in `names`, counted from one, or blank until one is chosen.
   */
  value: string
  isInvalid: boolean
  errorId: string
  onChange: (value: string) => void
  onBlur: () => void
}

function NameSelect({
  ref,
  label,
  blankLabel,
  names,
  value,
  isInvalid,
  errorId,
  onChange,
  onBlur,
}: NameSelectProps): ReactNode {
  return (
    <NativeSelect
      ref={ref}
      aria-label={label}
      aria-invalid={isInvalid}
      aria-describedby={errorId}
      value={value}
      onChange={(event) => {
        onChange(event.target.value)
      }}
      onBlur={onBlur}
    >
      <BlankOption value={value} label={blankLabel} />
      {names.map((name, index) => (
        <NativeSelectOption key={name} value={String(index + 1)}>
          {name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
