import { dayOfInstant, formatDay } from './time/dates'

export type SavedAway = {
  from: number
  day: number
  kind: 'log' | 'task' | 'notDone'
  /**
   * Counts up with each save, so a repeated notice is a new node its live region announces again.
   */
  id: number
}

/**
 * An outstanding task stays on today until done. A task due later today is listed on no day, but
 * today's Later today link counts it.
 */
export function taskDayOf(showAt: number, today: number, timeZone: string): number {
  return Math.max(dayOfInstant(showAt, timeZone), today)
}

export function savedAway(
  from: number,
  day: number,
  kind: SavedAway['kind'],
  previous: SavedAway | undefined,
): SavedAway | undefined {
  return day === from ? undefined : { from, day, kind, id: (previous?.id ?? 0) + 1 }
}

export function savedAwayWords(
  { day, kind }: SavedAway,
  today: number,
): { lead: string; dayLabel: string } {
  const isToday = day === today
  const dayLabel = isToday ? 'today' : formatDay(day, today)
  switch (kind) {
    case 'log': {
      return { lead: 'Logged on', dayLabel: formatDay(day, today) }
    }
    case 'task': {
      return { lead: 'Saved for', dayLabel }
    }
    case 'notDone': {
      return {
        lead: isToday ? 'Marked not done. It shows' : 'Marked not done. It shows on',
        dayLabel,
      }
    }
  }
}
