import { useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'

import {
  cellAfterArrowKey,
  chordOf,
  colOf,
  indexOf,
  rowOf,
} from '@/lib/x/puzzle-solvers/grid/geometry'
import { useClickOutside } from '@/hooks/use-click-outside'
import { focusRovingChild, useRovingFocus } from '@/hooks/use-roving-focus'

/**
 * Without `role`: lint checks a cell's ARIA attributes against the role it can read in the JSX.
 */
type GridCellProps = {
  'aria-rowindex': number
  'aria-colindex': number
  tabIndex: 0 | -1
  onFocus: () => void
}

type GridSelection = {
  selected: number | undefined
  setSelected: (cell: number | undefined) => void
  gridRef: RefObject<HTMLDivElement | null>
  /**
   * Wraps the grid and its controls: a press outside clears the cell.
   */
  rootRef: RefObject<HTMLDivElement | null>
  cellProps: (cell: number) => GridCellProps
  /**
   * For each cell's `onKeyDown`, since with a roving tabindex focus is on a cell. Moves as the ARIA
   * grid pattern says; true when the caller should do nothing more with the key.
   */
  moveOnNavigationKey: (event: KeyboardEvent) => boolean
  /**
   * For Escape on a cell.
   */
  deselect: (event: KeyboardEvent<HTMLElement>) => void
  focusSelected: () => void
}

/**
 * Nothing is selected until the user picks a cell, nor after a resize, which re-indexes every cell
 * so a kept selection could point past the end and swallow typing.
 */
export function useGridSelection(n: number, isClearedByPressOutside = true): GridSelection {
  const [state, setState] = useState<{ n: number; cell: number | undefined }>({
    n,
    cell: undefined,
  })
  // Dropped rather than only hidden, or going back to the old size would bring it back.
  if (state.n !== n) {
    setState({ n, cell: undefined })
  }
  const selected = state.n === n ? state.cell : undefined
  const setSelected = (cell: number | undefined): void => {
    setState({ n, cell })
  }
  const gridRef = useRovingFocus<HTMLDivElement>(selected)
  const rootRef = useClickOutside<HTMLDivElement>(() => {
    setSelected(undefined)
  }, isClearedByPressOutside)

  return {
    selected,
    setSelected,
    gridRef,
    rootRef,
    cellProps: (cell) => ({
      'aria-rowindex': rowOf(n, cell) + 1,
      'aria-colindex': colOf(n, cell) + 1,
      // With nothing selected the first cell is tabbable, or Tab has no way into the grid.
      tabIndex: cell === selected || (selected === undefined && cell === 0) ? 0 : -1,
      // Selection follows focus, so the controls below speak to the focused cell.
      onFocus: () => {
        setSelected(cell)
      },
    }),
    moveOnNavigationKey: (event) => {
      if (selected === undefined) return true
      const chord = chordOf(event)
      if (chord === 'browser') return true
      const isHomeOrEnd = event.key === 'Home' || event.key === 'End'
      const isToGridEnd = chord === 'gridEnd'
      const row = isToGridEnd ? (event.key === 'Home' ? 0 : n - 1) : rowOf(n, selected)
      const moved = isHomeOrEnd
        ? indexOf(n, row, event.key === 'Home' ? 0 : n - 1)
        : cellAfterArrowKey(n, selected, event.key)
      if (moved === undefined) {
        return false
      }
      setSelected(moved)
      event.preventDefault()
      return true
    },
    deselect: (event) => {
      setSelected(undefined)
      event.currentTarget.blur()
    },
    focusSelected: () => {
      focusRovingChild(gridRef.current, selected)
    },
  }
}
