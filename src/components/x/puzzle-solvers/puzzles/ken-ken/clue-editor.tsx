import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { parseTarget, shownClue } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/clue-draft'
import { CAGE_OPS, OP_SYMBOLS } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/model'
import type { Cage, CageOp } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/model'
import type { MarkedCageIssue } from '@/lib/x/puzzle-solvers/puzzles/ken-ken/validate'
import { FieldStatus } from '@/components/shared/field-status'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const OP_LABELS: Record<CageOp, string> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
  '=': 'a given value, no operator',
}

/**
 * A number input rather than a digit pad, because targets run into the thousands on larger grids.
 */
export function ClueEditor({
  n,
  cage,
  issue,
  issueId,
  isUnreviewed,
  onChange,
}: {
  n: number
  cage: Cage
  /**
   * Flagged and untouched: retyping the target or pressing the pressed operator confirms the clue.
   */
  isUnreviewed: boolean
  issue: MarkedCageIssue | undefined
  issueId: string
  /**
   * `isContinuingEdit` is set on every keystroke after the first in one visit to the field.
   */
  onChange: (cage: Cage, isContinuingEdit: boolean) => void
}): ReactNode {
  const targetId = useId()
  const isGiven = cage.op === '='
  const [text, setText] = useState<string>()
  const input = shownClue(text, cage.target)
  // Text that is not a clue leaves the cage unset, so only the field can say why.
  const statusId = useId()
  // Never coincides with an out-of-range stored target, since the cage is left unset.
  const isNotClueTyped = input !== '' && cage.target === 0
  const isTypingRef = useRef(false)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <ToggleGroup
          aria-label="Cage operator"
          aria-describedby={issue === 'arity' ? issueId : undefined}
          value={[cage.op]}
          onValueChange={([picked]) => {
            const op =
              isUnreviewed && picked === undefined
                ? cage.op
                : CAGE_OPS.find((candidate) => candidate === picked)
            if (op) {
              onChange({ ...cage, op }, false)
            }
          }}
          className="flex-wrap justify-center"
        >
          {CAGE_OPS.map((op) => (
            <ToggleGroupItem key={op} value={op} aria-label={OP_LABELS[op]}>
              <span aria-hidden="true">{op === '=' ? '=' : OP_SYMBOLS[op]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex items-center gap-1.5">
          <Label htmlFor={targetId}>{isGiven ? 'Value' : 'Target'}</Label>
          <Input
            id={targetId}
            type="number"
            inputMode="numeric"
            min={1}
            max={isGiven ? n : undefined}
            aria-invalid={isNotClueTyped || issue === 'out_of_range'}
            aria-describedby={issue === 'out_of_range' ? `${statusId} ${issueId}` : statusId}
            value={input}
            // eslint-disable-next-line slop/no-em-dash -- a mark for no clue, not prose
            placeholder="—"
            onChange={(event) => {
              const { value } = event.target
              setText(value)
              const target = parseTarget(value)
              // A leading zero is no edit, unless it confirms a flagged clue.
              if (!isUnreviewed && target === cage.target) return
              onChange({ ...cage, target }, isTypingRef.current)
              isTypingRef.current = true
            }}
            onBlur={() => {
              isTypingRef.current = false
            }}
            className="w-24"
          />
        </div>
      </div>

      <FieldStatus id={statusId} className="text-center empty:-mt-2">
        {isNotClueTyped ? 'Enter a whole number above 0' : undefined}
      </FieldStatus>
    </div>
  )
}
