import { useId } from 'react'
import type { ReactNode } from 'react'

import type { IntervalKind } from '@convex/shared/goalRules'

import { idRefs } from '@/lib/form-fields'
import { durationUnitsOf } from '@/lib/x/agenda/routines/duration-boxes'
import type { DurationBoxes, DurationUnit } from '@/lib/x/agenda/routines/duration-boxes'
import { FieldStatus } from '@/components/shared/field-status'
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const UNIT_WORDS: Record<DurationUnit, { suffix: string; name: string }> = {
  days: { suffix: 'days', name: 'Days' },
  hours: { suffix: 'hrs', name: 'Hours' },
  minutes: { suffix: 'mins', name: 'Minutes' },
}

type DurationFieldProps = {
  label: ReactNode
  help?: string
  kind: IntervalKind
  value: DurationBoxes
  /**
   * One message for each box out of range, shown under the boxes and tied to its own.
   */
  boxErrors: Partial<Record<DurationUnit, string>>
  /**
   * About the duration as a whole, tied to every box.
   */
  error: string | undefined
  onChange: (value: DurationBoxes) => void
}

/**
 * Messages show as a value is typed, as a number field's do, and a blocked save reveals and focuses
 * the first invalid box.
 */
export function DurationField({
  label,
  help,
  kind,
  value,
  boxErrors,
  error,
  onChange,
}: DurationFieldProps): ReactNode {
  const id = useId()
  const units = durationUnitsOf(kind)
  const helpId = help === undefined ? undefined : `${id}-help`
  const errorId = `${id}-error`
  return (
    <FieldSet className="gap-2" aria-describedby={idRefs(helpId, errorId)}>
      <FieldLegend>{label}</FieldLegend>
      <div className="flex flex-wrap gap-4">
        {units.map((unit) => {
          const boxId = `${id}-${unit}`
          return (
            <div key={unit} className="flex items-center gap-2">
              <Input
                id={boxId}
                type="text"
                inputMode="numeric"
                className="w-20"
                aria-invalid={boxErrors[unit] !== undefined || error !== undefined}
                aria-describedby={idRefs(`${boxId}-error`, errorId, helpId)}
                value={value[unit]}
                onChange={(event) => {
                  onChange({ ...value, [unit]: event.target.value })
                }}
              />
              <Label htmlFor={boxId} className="font-normal text-muted-foreground">
                <span aria-hidden="true">{UNIT_WORDS[unit].suffix}</span>
                <span className="sr-only">{UNIT_WORDS[unit].name}</span>
              </Label>
            </div>
          )
        })}
      </div>
      {help === undefined ? undefined : <FieldDescription id={helpId}>{help}</FieldDescription>}
      {units.map((unit) => (
        <FieldStatus key={unit} id={`${id}-${unit}-error`}>
          {boxErrors[unit]}
        </FieldStatus>
      ))}
      <FieldStatus id={errorId}>{error}</FieldStatus>
    </FieldSet>
  )
}
