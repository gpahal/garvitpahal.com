import type { ReactNode } from 'react'

import { pluralize } from '@/lib/text'
import type { ReviewUnit, SolveResult } from '@/lib/x/puzzle-solvers/puzzles/types'
import type { PuzzleOrigin } from '@/lib/x/puzzle-solvers/workspace-state'
import { NoticeAlert } from '@/components/shared/notice-alert'

/**
 * For a read, `unsolvable` and `multiple` almost always mean a misread; for a hand-entered puzzle,
 * a typing slip.
 */
function describeWarning(
  result: SolveResult | undefined,
  origin: PuzzleOrigin,
  timeoutHint: string,
): string | undefined {
  if (!result) {
    return undefined
  }

  switch (result.status) {
    case 'unsolvable': {
      return origin === 'read'
        ? 'This puzzle has no solution, which usually means something was read wrong. Compare it with the picture'
        : 'This puzzle has no solution. Check what you entered against the puzzle'
    }
    case 'multiple': {
      return origin === 'read'
        ? 'This puzzle has more than one solution, so something was probably missed in the read. One valid solution is shown below'
        : 'This puzzle has more than one solution, so something is probably missing. One valid solution is shown below'
    }
    case 'timeout': {
      return `Solving reached its time limit. ${timeoutHint}`
    }
    case 'solved': {
      return result.isUnique
        ? undefined
        : 'This solution is valid, but there was not time to check whether it is the only one'
    }
  }
}

/**
 * The general nudge stays through edits until Solve, since a correction does not mean the rest was
 * checked. It waits while a read runs, whose puzzle may replace this one; the count does not.
 */
function describeNudge(
  result: SolveResult | undefined,
  unreviewedCount: number,
  reviewUnit: ReviewUnit,
  reviewNote: string | undefined,
  isReviewPending: boolean,
  isReading: boolean,
): string | undefined {
  if (result) {
    return undefined
  }
  if (unreviewedCount > 0) {
    return `Check ${pluralize(unreviewedCount, `highlighted ${reviewUnit}`)} before solving`
  }
  return !isReviewPending || isReading
    ? undefined
    : (reviewNote ?? 'Check this matches your puzzle, then solve')
}

export function ReviewBanner({
  unreviewedCount,
  reviewUnit,
  reviewNote,
  isReviewPending,
  isReading,
  result,
  origin,
  timeoutHint,
}: {
  unreviewedCount: number
  reviewUnit: ReviewUnit
  reviewNote: string | undefined
  isReviewPending: boolean
  isReading: boolean
  result: SolveResult | undefined
  origin: PuzzleOrigin
  timeoutHint: string
}): ReactNode {
  const warning = describeWarning(result, origin, timeoutHint)
  if (warning !== undefined) {
    return <NoticeAlert message={warning} tone="warning" />
  }
  const nudge = describeNudge(
    result,
    unreviewedCount,
    reviewUnit,
    reviewNote,
    isReviewPending,
    isReading,
  )
  return nudge !== undefined ? (
    <NoticeAlert description={nudge} tone="info" announce="status" />
  ) : undefined
}
