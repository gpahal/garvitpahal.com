import { INTERVAL_MINUTES } from '@convex/shared/goalRules'
import type { IntervalKind } from '@convex/shared/goalRules'
import { DAY_MINUTES } from '@convex/shared/limits'

/**
 * Each box as typed. A daily goal has no days box, so its `days` is blank and never read.
 */
export type DurationBoxes = { days: string; hours: string; minutes: string }

export type DurationUnit = keyof DurationBoxes

export const NO_DURATION: DurationBoxes = { days: '', hours: '', minutes: '' }

const UNIT_MINUTES: Record<DurationUnit, number> = { days: DAY_MINUTES, hours: 60, minutes: 1 }

/**
 * Largest first.
 */
export function durationUnitsOf(kind: IntervalKind): ReadonlyArray<DurationUnit> {
  return kind === 'daily' ? ['hours', 'minutes'] : ['days', 'hours', 'minutes']
}

/**
 * Without a days box the hours reach 24, so a whole day can be typed. Nothing carries over, so 70
 * minutes is refused rather than read as an hour and ten.
 */
function mostInBox(kind: IntervalKind, unit: DurationUnit): number {
  switch (unit) {
    case 'days': {
      return INTERVAL_MINUTES[kind] / UNIT_MINUTES.days
    }
    case 'hours': {
      return kind === 'daily' ? 24 : 23
    }
    case 'minutes': {
      return 59
    }
  }
}

type ParsedDuration = {
  isEmpty: boolean
  /**
   * `undefined` while a box is out of range; a blank box is 0.
   */
  minutes: number | undefined
  errors: Partial<Record<DurationUnit, string>>
}

export function parseDuration(kind: IntervalKind, boxes: DurationBoxes): ParsedDuration {
  const errors: ParsedDuration['errors'] = {}
  for (const unit of durationUnitsOf(kind)) {
    const value = readBox(boxes[unit])
    const most = mostInBox(kind, unit)
    if (value === undefined || value > most) {
      errors[unit] = `Enter whole ${unit} from 0 to ${most}`
    }
  }
  const total = totalOf(kind, boxes)
  return {
    isEmpty: total === 'blank',
    minutes: Object.keys(errors).length > 0 ? undefined : total === 'blank' ? 0 : total,
    errors,
  }
}

/**
 * Blank is 0; any sign is refused, so "-0" and "+5" are refused as "-5" is.
 */
function readBox(text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed === '') {
    return 0
  }
  return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined
}

/**
 * The largest box takes what it can. Minutes that are not whole stay in the minutes box as they
 * are, which it then refuses.
 */
export function durationBoxesOf(kind: IntervalKind, minutes: number | undefined): DurationBoxes {
  if (minutes === undefined) {
    return NO_DURATION
  }
  const days = kind === 'daily' ? undefined : Math.floor(minutes / UNIT_MINUTES.days)
  const rest = minutes - (days ?? 0) * UNIT_MINUTES.days
  return {
    days: days === undefined ? '' : String(days),
    hours: String(Math.floor(rest / UNIT_MINUTES.hours)),
    minutes: String(rest % UNIT_MINUTES.hours),
  }
}

/**
 * Keeps the total even where the new boxes refuse it (a day and 2 hours is 26 hours for a daily
 * goal). Boxes that are not whole numbers have no total, so they stay as typed.
 */
export function resplitDuration(
  from: IntervalKind,
  to: IntervalKind,
  boxes: DurationBoxes,
): DurationBoxes {
  const total = totalOf(from, boxes)
  if (total === 'blank') {
    return NO_DURATION
  }
  if (total === undefined) {
    return to === 'daily' ? { ...boxes, days: '' } : boxes
  }
  return durationBoxesOf(to, total)
}

function totalOf(kind: IntervalKind, boxes: DurationBoxes): number | 'blank' | undefined {
  const units = durationUnitsOf(kind)
  if (units.every((unit) => boxes[unit].trim() === '')) {
    return 'blank'
  }
  let minutes = 0
  for (const unit of units) {
    const value = readBox(boxes[unit])
    if (value === undefined) {
      return undefined
    }
    minutes += value * UNIT_MINUTES[unit]
  }
  return minutes
}

/**
 * What dirtiness compares: the total, so "0 days 24 hours" and "1 day" are no edit. Boxes that are
 * not whole numbers compare as typed.
 */
export function comparableDuration(
  kind: IntervalKind,
  boxes: DurationBoxes,
  blank: 'none' | 'zero',
): string {
  const total = totalOf(kind, boxes)
  if (total === 'blank') {
    return blank === 'none' ? 'none' : '0'
  }
  return total === undefined
    ? JSON.stringify(durationUnitsOf(kind).map((unit) => boxes[unit]))
    : String(total)
}
