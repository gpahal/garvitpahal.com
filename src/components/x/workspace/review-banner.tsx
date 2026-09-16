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
  isVerifying,
  elapsedMs,
  result,
}: {
  unreviewedCount: number
  /**
   * Whether Solve is currently refused. A flag rather than the sentence itself, because the reason
   * is puzzle-specific and is already shown, once, next to the button it is about.
   */
  isBlocked: boolean
  /**
  Whether a better read may still replace what is on screen.
  */
  isVerifying: boolean
  /**
  Since the picture was taken, so the wait shown is the whole wait.
  */
  elapsedMs: number
  result: SolveResult<unknown> | undefined
}): ReactNode {
  const warning = describeWarning(result)
  // Before the first solve there is nothing to report on, so the banner nudges towards review
  // instead. Once a solve has run, only a warning is worth a line.
  //
  // The nudge is dropped while Solve is blocked: "then solve" above a button that refuses to would
  // be the screen contradicting itself, and the blocker below already says what to do first. It is
  // dropped while a read is still being checked too, since what is on screen may yet change. A
  // count of unreviewed parts still stands - that is a different job from the one blocking Solve.
  const message =
    warning ??
    (result
      ? undefined
      : unreviewedCount > 0
        ? `Check ${pluralize(unreviewedCount, 'highlighted part')} before solving`
        : isBlocked || isVerifying
          ? undefined
          : 'Check this matches your puzzle, then solve')

  if (!message && !isVerifying) {
    return undefined
  }

  return (
    <div className="flex flex-col gap-2">
      {isVerifying ? (
        <p className="unstyled my-0! rounded-md bg-gray-3 px-3 py-2 text-sm text-gray-11">
          {/* Only the sentence is a live region: announcing the timer would never stop. */}
          <span role="status">Checking this read, it may still change...</span>{' '}
          <span aria-hidden="true" className="tabular-nums">
            {(elapsedMs / 1000).toFixed(1)}s
          </span>
        </p>
      ) : undefined}
      {message ? (
        <p
          // A replacement read swaps the message, and a status region announces the new one.
          role={warning ? 'alert' : 'status'}
          className={`unstyled my-0! rounded-md px-3 py-2 text-sm ${
            warning ? 'bg-gray-4 text-gray-12' : 'bg-gray-3 text-gray-11'
          }`}
        >
          {message}
        </p>
      ) : undefined}
    </div>
  )
}
