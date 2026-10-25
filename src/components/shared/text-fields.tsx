import { useId } from 'react'
import type { ReactNode } from 'react'

import { useErrorOnceTouched } from '@/hooks/use-error-once-touched'
import { FieldStatus } from '@/components/shared/field-status'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type LabelledInputProps = {
  id: string
  'aria-invalid': boolean
  'aria-describedby': string
}

type LabelledFieldProps = {
  label: ReactNode
  help?: string
  error: string | undefined
  /**
   * A second `Field` sharing the row, such as a unit. The status then spans both.
   */
  beside?: ReactNode
  children: (input: LabelledInputProps) => ReactNode
}

/**
 * The input is the caller's: it spreads what `children` is given.
 */
export function LabelledField({
  label,
  help,
  error,
  beside,
  children,
}: LabelledFieldProps): ReactNode {
  const id = useId()
  const labelled = (
    <>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({
        id,
        'aria-invalid': error !== undefined,
        'aria-describedby': help === undefined ? `${id}-error` : `${id}-help ${id}-error`,
      })}
      {help === undefined ? undefined : (
        <FieldDescription id={`${id}-help`}>{help}</FieldDescription>
      )}
    </>
  )
  const status = <FieldStatus id={`${id}-error`}>{error}</FieldStatus>
  return beside === undefined ? (
    <Field>
      {labelled}
      {status}
    </Field>
  ) : (
    // The status sits outside the grid: a negative margin cannot undo a grid row's gap.
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-4">
        <Field>{labelled}</Field>
        {beside}
      </div>
      {status}
    </div>
  )
}

type RequiredTextFieldProps = {
  label: string
  maxLength: number
  value: string
  error: string | undefined
  onChange: (value: string) => void
}

export function RequiredTextField({
  label,
  maxLength,
  value,
  error,
  onChange,
}: RequiredTextFieldProps): ReactNode {
  const { shownError, touch } = useErrorOnceTouched(error)
  return (
    <LabelledField label={label} error={shownError}>
      {(input) => (
        <Input
          {...input}
          required
          maxLength={maxLength}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            touch()
          }}
          onBlur={touch}
        />
      )}
    </LabelledField>
  )
}

type WholeNumberFieldProps = {
  label: ReactNode
  min: number
  value: string
  error: string | undefined
  beside?: ReactNode
  onChange: (value: string) => void
}

export function WholeNumberField({
  label,
  min,
  value,
  error,
  beside,
  onChange,
}: WholeNumberFieldProps): ReactNode {
  return (
    <LabelledField label={label} error={error} beside={beside}>
      {(input) => (
        <Input
          {...input}
          type="number"
          inputMode="numeric"
          min={min}
          step={1}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
          }}
        />
      )}
    </LabelledField>
  )
}

export function OptionalMark(): ReactNode {
  return <span className="font-normal text-muted-foreground">(optional)</span>
}

type OptionalTextFieldProps = {
  label: string
  value: string
  rows: number
  maxLength: number
  onChange: (value: string) => void
}

export function OptionalTextField({
  label,
  value,
  rows,
  maxLength,
  onChange,
}: OptionalTextFieldProps): ReactNode {
  const id = useId()
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label} <OptionalMark />
      </FieldLabel>
      <Textarea
        id={id}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </Field>
  )
}
