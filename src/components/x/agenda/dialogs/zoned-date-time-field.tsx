import type { ReactNode, Ref } from 'react'

import { zoneLabel } from '@/lib/x/agenda/time/zone-label'
import { LabelledField } from '@/components/shared/text-fields'
import { Input } from '@/components/ui/input'

import type { ZonedDateTimeInput } from './use-zoned-date-time-input'

type ZonedDateTimeFieldProps = {
  label: string
  time: ZonedDateTimeInput
  error: string | undefined
  now: number
  /**
   * Says which zone the input is read in, when `Times are in {zone}` is not the whole story.
   */
  zoneNote?: string
  min?: string
  max?: string
  ref?: Ref<HTMLInputElement>
}

export function ZonedDateTimeField({
  label,
  time,
  error,
  now,
  zoneNote = `Times are in ${zoneLabel(time.zone, now)}`,
  min,
  max,
  ref,
}: ZonedDateTimeFieldProps): ReactNode {
  return (
    <LabelledField label={label} help={zoneNote} error={error}>
      {(input) => (
        <Input
          {...input}
          ref={ref}
          type="datetime-local"
          min={min}
          max={max}
          value={time.input}
          onChange={(event) => {
            time.setInput(event.target.value)
          }}
        />
      )}
    </LabelledField>
  )
}
