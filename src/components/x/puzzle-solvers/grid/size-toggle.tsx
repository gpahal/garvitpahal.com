import type { ReactNode } from 'react'

import { cn } from 'cn'

import { formatGridSize, speakGridSize } from '@/lib/x/puzzle-solvers/grid/geometry'
import { useDiscardConfirmation } from '@/hooks/use-discard-confirmation'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type SizeToggleProps = {
  sizes: ReadonlyArray<number>
  n: number
  isDestructive: (size: number) => boolean
  /**
   * What a resize clears, and that Undo brings it back.
   */
  body: string
  /**
   * Not called when the pressed size is picked again, where a resize would only discard work.
   */
  onPick: (size: number) => void
  className?: string
}

export function SizeToggle({
  sizes,
  n,
  isDestructive,
  body,
  onPick,
  className,
}: SizeToggleProps): ReactNode {
  const confirmation = useDiscardConfirmation()

  return (
    <>
      <ToggleGroup
        aria-label="Grid size"
        value={[String(n)]}
        onValueChange={([picked]) => {
          if (picked === undefined) {
            return
          }
          const size = Number(picked)
          confirmation.ask(
            isDestructive(size),
            { title: 'Change the grid size?', body, confirm: 'Change size' },
            () => {
              onPick(size)
            },
          )
        }}
        className={cn('flex-wrap justify-center', className)}
      >
        {/* Spoken "4 by 4" rather than "4 times 4", as the grids' own labels are. */}
        {sizes.map((size) => (
          <ToggleGroupItem
            key={size}
            value={String(size)}
            aria-label={`${formatGridSize(size)}, ${speakGridSize(size)}`}
          >
            {formatGridSize(size)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {confirmation.dialog}
    </>
  )
}
