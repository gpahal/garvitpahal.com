import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'

import { cn } from 'cn'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { isoWeekdayOfDay } from '@convex/shared/intervals'

import { dayAWeekAway, reachableDays } from '@/lib/x/agenda/day'
import {
  dayOfIsoDate,
  dayOfMonth,
  formatDay,
  isoDateOfDay,
  stripDays,
  stripStart,
  WEEKDAYS,
} from '@/lib/x/agenda/time/dates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type DayNavigationProps = {
  day: number
  today: number
  onSelect: (day: number) => void
  /**
   * Set by a control that goes as it chooses, such as Today or the saved-away link, so focus lands
   * on the chosen day's strip button; any change of day clears it.
   */
  focusDayRef: RefObject<number | undefined>
}

export function DayNavigation({
  day,
  today,
  focusDayRef,
  onSelect,
}: DayNavigationProps): ReactNode {
  const reachable = reachableDays(today)
  const { first, last } = reachable
  const [start, setStart] = useState(() => stripStart(undefined, day))
  const shownStart = stripStart(start, day)
  if (shownStart !== start) {
    setStart(shownStart)
  }
  // A week back or on moves the strip as far as the day, so the chosen day keeps its column.
  const moveWeek = (weeks: -1 | 1): void => {
    const next = dayAWeekAway(day, weeks, reachable)
    setStart(shownStart + next - day)
    // A step to a bound disables its button, so focus goes to the chosen day, as Today does.
    if (next === first || next === last) {
      focusDayRef.current = next
    }
    onSelect(next)
  }
  const selectedRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    const wanted = focusDayRef.current
    focusDayRef.current = undefined
    if (wanted === day) {
      selectedRef.current?.focus()
    }
  }, [day, focusDayRef])
  return (
    <nav aria-label="Days" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="font-medium">
          {day === today ? `Today, ${formatDay(day, today)}` : formatDay(day, today)}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          {day === today ? undefined : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                focusDayRef.current = today
                onSelect(today)
              }}
            >
              Today
            </Button>
          )}
          <JumpToDate day={day} first={first} last={last} onSelect={onSelect} />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous week"
          disabled={day <= first}
          onClick={() => {
            moveWeek(-1)
          }}
        >
          <ChevronLeft />
        </Button>
        <ol className="grid min-w-0 flex-1 grid-cols-7 gap-1">
          {stripDays(shownStart).map((date) => (
            <li key={date}>
              <Button
                ref={date === day ? selectedRef : undefined}
                variant={date === day ? 'default' : 'ghost'}
                aria-label={formatDay(date, today)}
                // Pressed is the choice; the current date is today, chosen or not.
                aria-pressed={date === day}
                aria-current={date === today ? 'date' : undefined}
                disabled={date < first || date > last}
                className="h-auto w-full flex-col gap-0.5 px-0 py-1.5"
                onClick={() => {
                  onSelect(date)
                }}
              >
                <span className="text-xs font-normal opacity-70">
                  {WEEKDAYS[isoWeekdayOfDay(date) - 1]}
                </span>
                <span
                  className={cn(
                    'tabular-nums',
                    date === today && 'underline decoration-2 underline-offset-4',
                  )}
                >
                  {dayOfMonth(date)}
                </span>
              </Button>
            </li>
          ))}
        </ol>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next week"
          disabled={day >= last}
          onClick={() => {
            moveWeek(1)
          }}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}

/**
 * Chrome fires a change for each year digit typed (`0002-10-25`), so a day out of reach is ignored
 * rather than chosen. The typed value is kept until blur: writing the chosen day back would reset
 * the half-typed year.
 */
function JumpToDate({
  day,
  first,
  last,
  onSelect,
}: Pick<DayNavigationProps, 'day' | 'onSelect'> & ReturnType<typeof reachableDays>): ReactNode {
  const [typed, setTyped] = useState<string>()
  return (
    <Input
      type="date"
      aria-label="Jump to date"
      className="w-auto"
      min={isoDateOfDay(first)}
      max={isoDateOfDay(last)}
      value={typed ?? isoDateOfDay(day)}
      onChange={(event) => {
        setTyped(event.target.value)
        const chosen = dayOfIsoDate(event.target.value)
        if (chosen !== undefined && chosen >= first && chosen <= last) {
          onSelect(chosen)
        }
      }}
      onBlur={() => {
        setTyped(undefined)
      }}
    />
  )
}
