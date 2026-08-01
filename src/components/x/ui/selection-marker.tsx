import type { ReactNode } from 'react'

/**
 * The box marking the selected cell of a grid. Belongs inside the cell, which must be `relative`.
 *
 * An overlay rather than an `outline` on the cell itself. Cells draw only their own top and left
 * borders, so that no line between two of them is drawn twice and doubled in width - which leaves
 * every cell's border box a different size on each side: 3px against a cage edge, 1px inside one,
 * and nothing at all on the right and bottom, where the line belongs to the next cell along. An
 * outline is a fixed inset from that box, so it lands exactly on the line on one side and short of
 * it on another. `inset-0` is measured from the padding box instead, so this sits just inside
 * whatever lines the cell happens to have, evenly, and covers none of them.
 */
export function SelectionMarker(): ReactNode {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 border-2 border-anchor"
    />
  )
}
