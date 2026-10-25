import { DAY_MINUTES } from './limits'

/**
 * As in '4 days 6 hrs 15 mins', a part-minute dropped. By hand because `Intl.DurationFormat` has no
 * 'mins' or 'hrs'.
 */
export function formatDuration(minutes: number): string {
  const whole = Math.floor(minutes)
  const days = Math.floor(whole / DAY_MINUTES)
  const parts = [
    unitOf(days, 'day'),
    unitOf(Math.floor((whole % DAY_MINUTES) / 60), 'hr'),
    unitOf(whole % 60, 'min'),
  ].filter((part) => part !== undefined)
  return parts.length === 0 ? '0 mins' : parts.join(' ')
}

function unitOf(count: number, unit: string): string | undefined {
  return count === 0 ? undefined : `${count} ${unit}${count === 1 ? '' : 's'}`
}
