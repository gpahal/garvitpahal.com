import { useId, type ReactNode } from 'react'

import {
  CAGE_OPS,
  createGrid,
  KEN_KEN_SIZES,
  opSymbol,
  type Cage,
  type CageOp,
  type KenKenPuzzle,
} from './model'

const PAD_BUTTON =
  'unstyled border-gray-6 hocus-visible:bg-gray-4 focus-visible:ring-anchor inline-flex h-9 items-center justify-center rounded-md border text-sm font-medium focus-visible:ring-2 focus-visible:outline-none'

const OP_LABELS: Record<CageOp, string> = {
  '+': 'add',
  '-': 'subtract',
  '*': 'multiply',
  '/': 'divide',
  '=': 'a given value, no operator',
}

/**
 * Size lives with the editor because changing it is almost always a correction. Unlike Sudoku, no
 * part of a cage layout survives a resize, so this starts over and says so.
 */
export function SizePad({
  puzzle,
  onChange,
}: {
  puzzle: KenKenPuzzle
  onChange: (puzzle: KenKenPuzzle) => void
}): ReactNode {
  const { n } = puzzle.grid

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        role="group"
        aria-label="Grid size"
        className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-1"
      >
        {KEN_KEN_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={size === n}
            onClick={() => {
              if (size !== n) {
                onChange({ grid: createGrid(size), unreviewedCages: [] })
              }
            }}
            className={`${PAD_BUTTON} px-2.5 ${
              size === n ? 'border-gray-12 bg-gray-12 text-gray-1' : 'text-gray-12'
            }`}
          >
            {size}&times;{size}
          </button>
        ))}
      </div>
      <p className="unstyled my-0! text-center text-sm text-gray-11">
        Changing the size clears every cage
      </p>
    </div>
  )
}

/**
 * The clue of whichever cage is in hand - the selected one, or the draft while its shape is being
 * edited. Controlled, so both callers get the same control without it having to know which is which.
 *
 * A number input rather than an on-screen digit pad: Ken Ken targets run into the thousands on a
 * larger grid, so a pad of the kind Sudoku uses would be the wrong control.
 */
export function ClueEditor({
  n,
  cage,
  onChange,
}: {
  n: number
  cage: Cage
  onChange: (cage: Cage) => void
}): ReactNode {
  const targetId = useId()
  const isGiven = cage.op === '='

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <div role="group" aria-label="Cage operator" className="flex flex-wrap justify-center gap-1">
        {CAGE_OPS.map((op) => (
          <button
            key={op}
            type="button"
            aria-pressed={op === cage.op}
            aria-label={OP_LABELS[op]}
            onClick={() => {
              onChange({ ...cage, op })
            }}
            className={`${PAD_BUTTON} w-9 ${
              op === cage.op ? 'border-gray-12 bg-gray-12 text-gray-1' : 'text-gray-12'
            }`}
          >
            <span aria-hidden="true">{op === '=' ? '=' : opSymbol(op)}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <label htmlFor={targetId} className="unstyled text-sm text-gray-11">
          {/* `=` is not a target to reach, it is the cell's own value, so the label says which. */}
          {isGiven ? 'Value' : 'Target'}
        </label>
        <input
          id={targetId}
          type="number"
          inputMode="numeric"
          min={1}
          max={isGiven ? n : undefined}
          value={cage.target === 0 ? '' : cage.target}
          placeholder="—"
          onChange={(event) => {
            const target = Number(event.target.value)
            onChange({
              ...cage,
              target: Number.isSafeInteger(target) && target > 0 ? target : 0,
            })
          }}
          className="unstyled h-9 w-24 rounded-md border border-gray-6 bg-bg px-2 text-sm text-gray-12 focus-visible:ring-2 focus-visible:ring-anchor focus-visible:outline-none"
        />
      </div>
    </div>
  )
}
