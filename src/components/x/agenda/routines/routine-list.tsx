import type { ReactNode } from 'react'

import { INTERVAL_KINDS } from '@convex/shared/goalRules'
import { isInRange } from '@convex/shared/intervals'

import type { Routine } from '@/lib/x/agenda/doc-types'
import { goalSummary, KIND_WORDS, owedLabel } from '@/lib/x/agenda/routines/routine-format'
import { OpenRow } from '@/components/shared/open-row'
import { RowSection } from '@/components/shared/row-section'
import { MutedText } from '@/components/shared/typography'

import { RoutineProgress } from './routine-progress'
import type { TrackedRoutine } from './use-routines'

const BADGE_CLASS =
  'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent bg-primary px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary-foreground'

type RoutineRowProps = {
  routine: Routine
  children?: ReactNode
  aside?: ReactNode
  onOpen: () => void
}

function RoutineRow({ routine, children, aside, onOpen }: RoutineRowProps): ReactNode {
  return (
    <OpenRow title={routine.name} description={routine.description} aside={aside} onOpen={onOpen}>
      <MutedText>{goalSummary(routine.goal)}</MutedText>
      {children}
    </OpenRow>
  )
}

type RoutineListProps = {
  title?: string
  routines: Array<Routine>
  onOpen: (routine: Routine) => void
}

export function RoutineList({ title, routines, onOpen }: RoutineListProps): ReactNode {
  return routines.length === 0 ? undefined : (
    <RowSection title={title}>
      {routines.map((routine) => (
        <li key={routine._id}>
          <RoutineRow
            routine={routine}
            onOpen={() => {
              onOpen(routine)
            }}
          />
        </li>
      ))}
    </RowSection>
  )
}

type RoutineGroupsProps = {
  tracked: Array<TrackedRoutine>
  /**
   * Tells the interval around now from another, which the badge names differently.
   */
  nowLocal: number
  onOpen: (routine: Routine) => void
}

export function RoutineGroups({ tracked, nowLocal, onOpen }: RoutineGroupsProps): ReactNode {
  return INTERVAL_KINDS.map((kind) => {
    const ofKind = tracked.filter(({ routine }) => routine.goal.kind === kind)
    return ofKind.length === 0 ? undefined : (
      <RowSection key={kind} title={KIND_WORDS[kind].title} level="h3">
        {ofKind.map((entry) => {
          const { interval, owed } = entry.status
          const isCurrent = isInRange(interval, nowLocal)
          return (
            <li key={entry.routine._id}>
              <RoutineRow
                routine={entry.routine}
                aside={
                  // Text rather than `aria-label`, which a plain element does not reliably carry.
                  <span className={BADGE_CLASS}>
                    <span aria-hidden="true">{owed}</span>
                    <span className="sr-only">
                      {owedLabel(entry.routine.goal, entry.status, { isCurrent })}
                    </span>
                  </span>
                }
                onOpen={() => {
                  onOpen(entry.routine)
                }}
              >
                <RoutineProgress tracked={entry} isCurrent={isCurrent} />
              </RoutineRow>
            </li>
          )
        })}
      </RowSection>
    )
  })
}
