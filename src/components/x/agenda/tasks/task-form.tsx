import { useId, useState } from 'react'
import type { ReactNode } from 'react'

import { useMutation } from 'convex/react'

import { api } from '@convex/_generated/api'
import { EARLIEST_LOCAL, MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from '@convex/shared/limits'

import { ifChanged } from '@/lib/form-fields'
import type { Task } from '@/lib/x/agenda/doc-types'
import { nameError } from '@/lib/x/agenda/field-errors'
import { lastShowAtInput, showAtError } from '@/lib/x/agenda/task-show-at'
import { instantRangeOfDay, localToDateTimeInput, toDateTimeInput } from '@/lib/x/agenda/time/dates'
import { useNow } from '@/hooks/use-now'
import { useSubmit } from '@/hooks/use-submit'
import { FormDialogContent } from '@/components/shared/form-dialog-content'
import { OptionalTextField, RequiredTextField } from '@/components/shared/text-fields'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

import { useFormTimeZone, useZonedDateTimeInput } from '../dialogs/use-zoned-date-time-input'
import { ZonedDateTimeField } from '../dialogs/zoned-date-time-field'

type TaskFormProps = {
  task: Task | undefined
  defaultShowDay: number | undefined
  onSaved: ((showAt: number) => void) | undefined
  onClose: () => void
}

export function TaskForm({ task, defaultShowDay, onSaved, onClose }: TaskFormProps): ReactNode {
  const now = useNow()
  const zone = useFormTimeZone()
  const id = useId()
  const create = useMutation(api.tasks.create)
  const update = useMutation(api.tasks.update)
  const submit = useSubmit()

  const [initial] = useState(() => ({
    name: task?.name ?? '',
    description: task?.description ?? '',
    showAt: task?.showAt,
    now,
    defaultShowDay,
    isImmediate: task === undefined && defaultShowDay === undefined,
  }))
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  // "Immediately", offered only while creating, writes `useNow`'s minute, not `Date.now()`, since the
  // screens split due from scheduled by that minute. No mode is stored.
  const [isImmediate, setIsImmediate] = useState(initial.isImmediate)
  const untouchedAt =
    initial.showAt ??
    (initial.defaultShowDay === undefined
      ? initial.now
      : instantRangeOfDay(initial.defaultShowDay, zone).start)
  const time = useZonedDateTimeInput(zone, {
    at: untouchedAt,
    input: toDateTimeInput(untouchedAt, zone),
  })

  const showAt = isImmediate ? now : time.at
  const nameIssue = nameError(name)
  const showAtIssue = showAtError({
    showAt,
    isKept: isImmediate || (task !== undefined && time.isUntouched),
    now,
    zone,
  })
  const isInvalid = nameIssue !== undefined || showAtIssue !== undefined

  const save = (): void => {
    if (isInvalid || showAt === undefined) {
      return
    }
    submit.run(
      async () =>
        task
          ? update({
              id: task._id,
              name: ifChanged(initial.name, name),
              description: ifChanged(initial.description, description),
              showAt: time.isUntouched ? undefined : showAt,
            })
          : create({ name, description, showAt }),
      {
        onSuccess: () => {
          onSaved?.(showAt)
          onClose()
        },
      },
    )
  }

  return (
    <FormDialogContent
      title={task ? 'Edit task' : 'New task'}
      submit={submit}
      isInvalid={isInvalid}
      isDirty={
        name !== initial.name ||
        description !== initial.description ||
        !time.isUntouched ||
        isImmediate !== initial.isImmediate
      }
      onSubmit={save}
    >
      <FieldGroup>
        <RequiredTextField
          label="Name"
          maxLength={MAX_NAME_LENGTH}
          value={name}
          error={nameIssue}
          onChange={setName}
        />
        <OptionalTextField
          label="Description"
          value={description}
          rows={3}
          maxLength={MAX_DESCRIPTION_LENGTH}
          onChange={setDescription}
        />
        {task === undefined ? (
          <Field>
            <FieldLabel htmlFor={`${id}-mode`}>Show</FieldLabel>
            <NativeSelect
              id={`${id}-mode`}
              value={isImmediate ? 'immediately' : 'later'}
              onChange={(event) => {
                setIsImmediate(event.target.value === 'immediately')
              }}
            >
              <NativeSelectOption value="immediately">Immediately</NativeSelectOption>
              <NativeSelectOption value="later">From a set time</NativeSelectOption>
            </NativeSelect>
          </Field>
        ) : undefined}
        {isImmediate ? undefined : (
          <ZonedDateTimeField
            label="Show from"
            time={time}
            error={showAtIssue}
            now={now}
            min={localToDateTimeInput(EARLIEST_LOCAL)}
            max={lastShowAtInput(now, zone)}
          />
        )}
      </FieldGroup>
    </FormDialogContent>
  )
}
