import type { ReactNode } from 'react'

import { pluralize } from '@/lib/x/text'
import type { SolveResult } from '@/puzzles/types'

/**
 * What is wrong with a solve, or `undefined` if nothing is.
 *
 * `unsolvable` and `multiple` almost always mean the picture was misread rather than that the puzzle
 * is unusual, so the copy points at the puzzle rather than blaming the solver. A solution that could
 * not be proven unique gets its own line: the answer is real, but the uniqueness check that makes a
 * read trustworthy never finished, so it says that rather than implying either of the other two.
 *
 * Kept deliberately puzzle-neutral - "something", not "a digit" - so a puzzle with no digits in it
 * still reads correctly without every puzzle having to supply its own wording.
 */
function describeWarning(result: SolveResult<unknown> | undefined): string | undefined {
  if (!result) {
    return undefined
  }

  switch (result.status) {
    case 'unsolvable': {
      return 'This puzzle has no solution, which usually means something was read wrong. Check the highlighted parts and try again'
    }
    case 'multiple': {
      return 'This puzzle has more than one solution, so something is probably missing. One valid solution is shown below'
    }
    case 'timeout': {
      return 'Solving timed out. That usually points to something being read wrong rather than a hard puzzle'
    }
    default: {
      return result.isUnique
        ? undefined
        : 'Solving ran out of time before it could rule out a second solution. The answer below is valid, but something may still have been read wrong'
    }
  }
}

export function ReviewBanner({
  unreviewedCount,
  isBlocked,
  result,
}: {
  unreviewedCount: number
  /**
   * Whether Solve is currently refused. A flag rather than the sentence itself, because the reason
   * is puzzle-specific and is already shown, once, next to the button it is about.
   */
  isBlocked: boolean
  result: SolveResult<unknown> | undefined
}): ReactNode {
  const warning = describeWarning(result)
  // Before the first solve there is nothing to report on, so the banner nudges towards review
  // instead. Once a solve has run, only a warning is worth a line.
  //
  // The nudge is dropped while Solve is blocked: "then solve" above a button that refuses to would
  // be the screen contradicting itself, and the blocker below already says what to do first. A
  // count of unreviewed parts still stands - that is a different job from the one blocking Solve.
  const message =
    warning ??
    (result
      ? undefined
      : unreviewedCount > 0
        ? `Check ${pluralize(unreviewedCount, 'highlighted part')} before solving`
        : isBlocked
          ? undefined
          : 'Check this matches your puzzle, then solve')

  if (!message) {
    return undefined
  }

  return (
    <p
      role={warning ? 'alert' : undefined}
      className={`unstyled my-0! rounded-md px-3 py-2 text-sm ${
        warning ? 'bg-gray-4 text-gray-12' : 'bg-gray-3 text-gray-11'
      }`}
    >
      {message}
    </p>
  )
}
