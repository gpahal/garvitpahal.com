import { describe, expect, it } from 'vitest'

import { goalIssue } from '@convex/shared/goalRules'
import { MAX_GOAL_COUNT, MAX_REMINDERS } from '@convex/shared/limits'

import { durationBoxesOf } from './duration-boxes'
import { areRoutineDraftsDifferent, draftOf, parseDraft, withKind } from './routine-draft'
import type { RoutineDraft } from './routine-draft'
import type { Goal } from './schedule'

describe('withKind', () => {
  it.each([
    ['daily', 'weekly', { weekday: '' }],
    ['monthly', 'yearly', { month: '' }],
  ] as const)(
    'blanks what a %s reminder did not show when it becomes %s, leaving it to choose',
    (from, to, blanks) => {
      const draft = { ...draftOf(undefined), name: 'Stretch', kind: from }
      const [first] = draft.reminders
      const changed = withKind(draft, to)
      expect(changed.reminders).toEqual([{ ...first!, ...blanks }])
      expect(parseDraft(changed).goal).toBeUndefined()
    },
  )
})

describe('areRoutineDraftsDifferent', () => {
  it.each([
    ['daily', 'weekly'],
    ['monthly', 'yearly'],
  ] as const)('counts %s to %s and back as unchanged', (kind, other) => {
    const initial = { ...draftOf(undefined), name: 'Stretch', kind }
    const roundTrip = withKind(withKind(initial, other), kind)
    expect(areRoutineDraftsDifferent(initial, roundTrip)).toBe(false)
  })

  it('counts a round trip that blanks a shown field as changed', () => {
    const initial = { ...draftOf(undefined), name: 'Stretch', kind: 'yearly' as const }
    const roundTrip = withKind(withKind(initial, 'daily'), 'yearly')
    expect(areRoutineDraftsDifferent(initial, roundTrip)).toBe(true)
  })
})

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * Built without `draftOf` so an out-of-range number reaches the form as typed rather than
 * formatted into range.
 */
function draftFor(goal: Goal): RoutineDraft {
  const text = (value: number | undefined) => (value === undefined ? '' : String(value))
  return {
    ...draftOf(undefined),
    name: 'Stretch',
    kind: goal.kind,
    count: String(goal.count),
    duration: durationBoxesOf(goal.kind, goal.minutesEach),
    reminders: goal.reminders.map((reminder, index) => ({
      id: String(index),
      time: `${pad(Math.floor(reminder.minuteOfDay / 60))}:${pad(reminder.minuteOfDay % 60)}`,
      weekday: text('weekday' in reminder ? reminder.weekday : undefined),
      day: text('day' in reminder ? reminder.day : undefined),
      month: text('month' in reminder ? reminder.month : undefined),
    })),
  }
}

const NOON = 12 * 60

const daily = (count: number, times: Array<number>, minutesEach?: number): Goal => ({
  kind: 'daily',
  count,
  ...(minutesEach !== undefined && { minutesEach }),
  reminders: times.map((minuteOfDay) => ({ minuteOfDay })),
})

const weekly = (weekday: number): Goal => ({
  kind: 'weekly',
  count: 1,
  reminders: [{ weekday, minuteOfDay: NOON }],
})

const monthly = (days: Array<number>, minutesEach?: number): Goal => ({
  kind: 'monthly',
  count: days.length,
  ...(minutesEach !== undefined && { minutesEach }),
  reminders: days.map((day) => ({ day, minuteOfDay: NOON })),
})

const yearly = (dates: Array<[month: number, day: number]>, minutesEach?: number): Goal => ({
  kind: 'yearly',
  count: dates.length,
  ...(minutesEach !== undefined && { minutesEach }),
  reminders: dates.map(([month, day]) => ({ month, day, minuteOfDay: NOON })),
})

const minutes = (count: number) => Array.from({ length: count }, (_, index) => index)

const DAY = 1440

/**
 * The form must accept every goal the server's `goalIssue` does, as the same goal, and refuse a
 * breach of each rule at the field it is about.
 */
const ALLOWED: Array<[label: string, goal: Goal]> = [
  [
    'a count at the most, and the shortest duration',
    daily(MAX_GOAL_COUNT, minutes(MAX_GOAL_COUNT), 1),
  ],
  ['a day each, daily', daily(1, [NOON], DAY)],
  ['the shortest month each, monthly', monthly([1], 28 * DAY)],
  ['a year each, yearly', yearly([[1, 1]], 365 * DAY)],
  ['the most reminders', daily(1, minutes(MAX_REMINDERS))],
  ['the first and last minutes of the day', daily(2, [0, 1439])],
  ['Sunday', weekly(7)],
  ['a monthly 31st, and the same day counted from the end', monthly([31, -31])],
  ['29 February', yearly([[2, 29]])],
  [
    '1 February and the 28th from its end',
    yearly([
      [2, 1],
      [2, -28],
    ]),
  ],
]

const anyMessage = expect.any(String) as unknown

/**
 * One breach of each rule, with the field the form shows it on.
 */
const REFUSED: Array<[rule: string, goal: Goal, where: object]> = [
  ['a count out of range', daily(0, [NOON]), { count: anyMessage }],
  ['a duration that is not a positive whole minute', daily(1, [NOON], 0), { duration: anyMessage }],
  ['a duration each over the interval', daily(1, [NOON], DAY + 1), { duration: anyMessage }],
  ['a total over the interval', daily(2, [0, NOON], DAY / 2 + 1), { duration: anyMessage }],
  ['fewer reminders than the count', daily(2, [NOON]), { reminders: anyMessage }],
  ['more than the most reminders', daily(1, minutes(MAX_REMINDERS + 1)), { reminders: anyMessage }],
  ['a time out of range', daily(1, [1440]), { reminderRows: { 0: { field: 'time' } } }],
  ['a weekday out of range', weekly(8), { reminderRows: { 0: { field: 'weekday' } } }],
  ['a monthly day out of range', monthly([32]), { reminderRows: { 0: { field: 'day' } } }],
  ['a yearly month out of range', yearly([[13, 1]]), { reminderRows: { 0: { field: 'month' } } }],
  ['a yearly day the month lacks', yearly([[4, 31]]), { reminderRows: { 0: { field: 'day' } } }],
  [
    'the same nudge twice',
    yearly([
      [1, 1],
      [1, -31],
    ]),
    { reminderRows: { 1: { field: 'time' } } },
  ],
]

describe('routine goals, the form and the server', () => {
  it.each(ALLOWED)('both accept %s, as the same goal', (_label, goal) => {
    expect(goalIssue(goal), 'the server').toBeUndefined()
    const { errors, goal: parsed } = parseDraft(draftFor(goal))
    expect(errors.goal, 'the form').toBeUndefined()
    expect(parsed, 'the form').toEqual(goal)
  })

  it.each(REFUSED)('both refuse %s, the form at its field', (_rule, goal, where) => {
    expect(goalIssue(goal), 'the server').toBeDefined()
    const { errors, goal: parsed } = parseDraft(draftFor(goal))
    expect(errors, 'the form').toMatchObject(where)
    expect(parsed, 'the form').toBeUndefined()
  })
})
