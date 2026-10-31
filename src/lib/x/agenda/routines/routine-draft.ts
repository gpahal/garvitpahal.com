import {
  goalFitIssue,
  goalIssue,
  INTERVAL_KINDS,
  isGoalCount,
  isSignedDay,
  LAST_MINUTE_OF_DAY,
  longestLength,
  minutesEachIssue,
  reminderCountIssue,
  reminderSlotKey,
} from '@convex/shared/goalRules'
import type { IntervalKind } from '@convex/shared/goalRules'
import { MAX_GOAL_COUNT } from '@convex/shared/limits'
import type { Goal } from '@convex/shared/reminders'

import { parseWhole } from '@/lib/form-fields'
import { MONTHS } from '@/lib/months'

import type { Routine } from '../doc-types'
import { nameError } from '../field-errors'
import { toMinuteInput, WEEKDAYS } from '../time/dates'
import {
  comparableDuration,
  durationBoxesOf,
  NO_DURATION,
  parseDuration,
  resplitDuration,
} from './duration-boxes'
import type { DurationBoxes, DurationUnit } from './duration-boxes'
import { formatMinuteOfDay } from './routine-format'

/**
 * Every field any kind could ask for, as typed, so switching the interval keeps what the kinds
 * share. `id` is only the row's key and is never stored.
 */
export type ReminderDraft = {
  id: string
  time: string
  weekday: string
  day: string
  month: string
}

export type RoutineDraft = {
  name: string
  description: string
  kind: IntervalKind
  count: string
  duration: DurationBoxes
  reminders: Array<ReminderDraft>
}

/**
 * Compares raw strings so invalid input is dirty too; the duration compares its total. A reminder
 * compares only the fields its kind shows, since `withKind` blanks hidden ones.
 */
export function areRoutineDraftsDifferent(initial: RoutineDraft, current: RoutineDraft): boolean {
  const values = (draft: RoutineDraft) => [
    draft.name,
    draft.description,
    draft.kind,
    draft.count,
    comparableDuration(draft.kind, draft.duration, 'none'),
    draft.reminders.map((reminder) => [
      reminder.time,
      ...FIELDS_LEFT_TO_CHOOSE[draft.kind].map((field) => reminder[field]),
    ]),
  ]
  return JSON.stringify(values(initial)) !== JSON.stringify(values(current))
}

type DraftErrors = {
  name?: string
  count?: string
  duration?: string
  durationBoxes: Partial<Record<DurationUnit, string>>
  reminders?: string
  reminderRows: Record<string, ReminderError | undefined>
  /**
   * What `goalIssue` refuses in a goal every field accepts. The field checks should leave it
   * nothing to say; it keeps a goal the server would refuse from being sent.
   */
  goal?: string
}

export type ReminderError = { field: 'weekday' | 'month' | 'day' | 'time'; message: string }

function newReminder(id: string = crypto.randomUUID()): ReminderDraft {
  return { id, time: '09:00', weekday: '1', day: '1', month: '1' }
}

/**
 * The fields that tell reminders of a kind apart, in row order, which an added row leaves for the
 * owner to choose. A yearly month blanks with its day, since a copied month would choose half the
 * date.
 */
export const FIELDS_LEFT_TO_CHOOSE = {
  daily: ['time'],
  weekly: ['weekday'],
  monthly: ['day'],
  yearly: ['month', 'day'],
} as const satisfies Record<IntervalKind, ReadonlyArray<ReminderError['field']>>

/**
 * `id` is the new row's key.
 */
export function addedReminder(
  { kind, reminders }: Pick<RoutineDraft, 'kind' | 'reminders'>,
  id: string,
): ReminderDraft {
  const last = reminders.at(-1)
  if (last === undefined) {
    return newReminder(id)
  }
  const added: ReminderDraft = { ...last, id }
  const blanks: ReadonlyArray<ReminderError['field']> = FIELDS_LEFT_TO_CHOOSE[kind]
  for (const field of blanks) {
    added[field] = ''
  }
  return added
}

export function draftOf(routine: Routine | undefined): RoutineDraft {
  if (!routine) {
    return {
      name: '',
      description: '',
      kind: 'daily',
      count: '1',
      duration: NO_DURATION,
      reminders: [newReminder()],
    }
  }
  const { goal } = routine
  return {
    name: routine.name,
    description: routine.description ?? '',
    kind: goal.kind,
    count: String(goal.count),
    duration: durationBoxesOf(goal.kind, goal.minutesEach),
    reminders: goal.reminders.map((reminder) => ({
      ...newReminder(),
      time: formatMinuteOfDay(reminder.minuteOfDay),
      ...('weekday' in reminder && { weekday: String(reminder.weekday) }),
      ...('day' in reminder && { day: String(reminder.day) }),
      ...('month' in reminder && { month: String(reminder.month) }),
    })),
  }
}

export function isIntervalKind(value: string): value is IntervalKind {
  return (INTERVAL_KINDS as ReadonlyArray<string>).includes(value)
}

export function withKind(draft: RoutineDraft, kind: IntervalKind): RoutineDraft {
  // Every kind shows the time.
  const shown = new Set<ReminderError['field']>([...FIELDS_LEFT_TO_CHOOSE[draft.kind], 'time'])
  const blanks = FIELDS_LEFT_TO_CHOOSE[kind].filter((field) => !shown.has(field))
  return {
    ...draft,
    kind,
    duration: resplitDuration(draft.kind, kind, draft.duration),
    reminders: draft.reminders.map((reminder) => {
      const changed = { ...reminder }
      for (const field of blanks) {
        changed[field] = ''
      }
      return changed
    }),
  }
}

function parseTime(value: string): number | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(toMinuteInput(value))
  if (!match) {
    return undefined
  }
  const minutes = Number(match[2])
  const minuteOfDay = Number(match[1]) * 60 + minutes
  return minutes <= 59 && minuteOfDay <= LAST_MINUTE_OF_DAY ? minuteOfDay : undefined
}

export function dayLengthOf(kind: IntervalKind, month: string): number {
  return longestLength(kind === 'yearly' ? parseWhole(month) : undefined)
}

/**
 * The editor offers only these, so a day the month lacks cannot be chosen.
 */
export function dayChoices(length: number): { fromStart: Array<number>; fromEnd: Array<number> } {
  const fromStart = Array.from({ length }, (_, index) => index + 1)
  return { fromStart, fromEnd: fromStart.map((day) => -day) }
}

function fittedDay(value: string, length: number): string {
  const day = parseWhole(value)
  if (day === undefined) {
    return ''
  }
  return day === 0 ? '1' : String(Math.sign(day) * Math.min(Math.abs(day), length))
}

/**
 * Moves a day its month lacks to the nearest one on the same side. Run on every edit, since a
 * month or interval change can leave a day behind; a blank day stays blank rather than becoming
 * the 1st.
 */
export function withFittedDays(draft: RoutineDraft): RoutineDraft {
  return {
    ...draft,
    reminders: draft.reminders.map((reminder) => ({
      ...reminder,
      day: fittedDay(reminder.day, dayLengthOf(draft.kind, reminder.month)),
    })),
  }
}

function parseDay(value: string, length: number): number | undefined {
  const day = parseWhole(value)
  return day !== undefined && isSignedDay(day, length) ? day : undefined
}

function parseName(value: string, names: ReadonlyArray<string>): number | undefined {
  const place = parseWhole(value)
  return place !== undefined && place >= 1 && place <= names.length ? place : undefined
}

type ParsedReminder = { minuteOfDay: number; weekday: number; day: number; month: number }

/**
 * A field the kind does not use reads as 1, which neither the stored goal nor the slot key reads.
 */
function parseReminder(kind: IntervalKind, draft: ReminderDraft): ParsedReminder | ReminderError {
  const weekday = kind === 'weekly' ? parseName(draft.weekday, WEEKDAYS) : 1
  if (weekday === undefined) {
    return { field: 'weekday', message: 'Choose a day' }
  }
  const month = kind === 'yearly' ? parseName(draft.month, MONTHS) : 1
  if (month === undefined) {
    return { field: 'month', message: 'Choose a month' }
  }
  const length = dayLengthOf(kind, draft.month)
  // The day select is refitted to the month, so an out-of-range day is as unchosen as a blank.
  const day = kind === 'monthly' || kind === 'yearly' ? parseDay(draft.day, length) : 1
  if (day === undefined) {
    return { field: 'day', message: 'Choose a day' }
  }
  const minuteOfDay = parseTime(draft.time)
  return minuteOfDay === undefined
    ? { field: 'time', message: 'Choose a time' }
    : { minuteOfDay, weekday, day, month }
}

function toGoal(
  kind: IntervalKind,
  fields: { count: number; minutesEach: number | undefined },
  reminders: Array<ParsedReminder>,
): Goal {
  switch (kind) {
    case 'daily': {
      return {
        kind,
        ...fields,
        reminders: reminders.map(({ minuteOfDay }) => ({ minuteOfDay })),
      }
    }
    case 'weekly': {
      return {
        kind,
        ...fields,
        reminders: reminders.map(({ weekday, minuteOfDay }) => ({ weekday, minuteOfDay })),
      }
    }
    case 'monthly': {
      return {
        kind,
        ...fields,
        reminders: reminders.map(({ day, minuteOfDay }) => ({ day, minuteOfDay })),
      }
    }
    case 'yearly': {
      return {
        kind,
        ...fields,
        reminders: reminders.map(({ month, day, minuteOfDay }) => ({ month, day, minuteOfDay })),
      }
    }
  }
}

/**
 * `goal` is `undefined` while any goal field is wrong or `goalIssue` refuses it; a name error alone
 * does not withhold it.
 */
export function parseDraft(draft: RoutineDraft): { errors: DraftErrors; goal: Goal | undefined } {
  const duration = parseDuration(draft.kind, draft.duration)
  const errors: DraftErrors = {
    name: nameError(draft.name),
    durationBoxes: duration.errors,
    reminderRows: {},
  }

  const count = parseWhole(draft.count)
  if (count === undefined || !isGoalCount(count)) {
    errors.count = `Enter a whole number from 1 to ${MAX_GOAL_COUNT}`
  }
  const minutesEach = duration.isEmpty ? undefined : duration.minutes
  if (minutesEach !== undefined) {
    errors.duration =
      minutesEachIssue(minutesEach) ??
      (count !== undefined && errors.count === undefined
        ? goalFitIssue(draft.kind, count, minutesEach)
        : undefined)
  }

  const reminders: Array<ParsedReminder> = []
  const slots = new Set<string>()
  for (const reminderDraft of draft.reminders) {
    const parsed = parseReminder(draft.kind, reminderDraft)
    if ('field' in parsed) {
      errors.reminderRows[reminderDraft.id] = parsed
      continue
    }
    const slot = reminderSlotKey(draft.kind, parsed)
    if (slots.has(slot)) {
      errors.reminderRows[reminderDraft.id] = {
        field: 'time',
        message: 'This reminder is the same as another. Change or remove one of them',
      }
      continue
    }
    slots.add(slot)
    reminders.push(parsed)
  }
  // A bad count has its own message and asks for no reminders here.
  const countIssue = reminderCountIssue(
    count !== undefined && errors.count === undefined ? count : 0,
    draft.reminders.length,
  )
  if (countIssue !== undefined) {
    errors.reminders = countIssue
  }

  const isGoalValid =
    errors.count === undefined &&
    duration.minutes !== undefined &&
    errors.duration === undefined &&
    errors.reminders === undefined &&
    reminders.length === draft.reminders.length
  const goal =
    isGoalValid && count !== undefined
      ? toGoal(draft.kind, { count, minutesEach }, reminders)
      : undefined
  const issue = goal === undefined ? undefined : goalIssue(goal)
  if (issue !== undefined) {
    errors.goal = issue
  }
  return { errors, goal: issue === undefined ? goal : undefined }
}
