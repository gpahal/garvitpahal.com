import type { ReactNode } from 'react'

import { progressLabel } from '@/lib/x/agenda/routines/routine-format'
import { Progress } from '@/components/ui/progress'

import type { TrackedRoutine } from './use-routines'

/**
 * How far a goal with a duration has got towards the whole interval's goal. It is the only progress
 * a count cannot show: the badge says what is owed, and a half-finished occurrence moves only this.
 */
export function RoutineProgress({
  tracked,
  isCurrent,
}: {
  tracked: TrackedRoutine
  isCurrent: boolean
}): ReactNode {
  const { goal } = tracked.routine
  return goal.minutesEach === undefined ? undefined : (
    <Progress
      className="mt-1"
      value={(tracked.status.completed / goal.count) * 100}
      aria-label={`${tracked.routine.name} progress`}
      aria-valuetext={progressLabel(goal, tracked.status, {
        isCurrent,
      })}
    />
  )
}
