import { describe, expect, it } from 'vitest'

import { DAY_MS, MINUTE_MS } from '@convex/shared/limits'
import { toLocal } from '@convex/shared/localTime'

import type { RoutineLog } from '../doc-types'
import { KOLKATA, NEW_YORK } from '../time/test-readings'
import { durationBoxesOf } from './duration-boxes'
import { parseLogDraft } from './log-draft'

const NOW = Date.parse('2026-09-16T15:20:00+05:30')

/**
 * Neither its zone nor its 90-second length survives being read back through the inputs.
 */
const STORED_AT = NOW - 60 * MINUTE_MS
const STORED = {
  started: { at: STORED_AT, atLocal: toLocal(STORED_AT, NEW_YORK) },
  ended: { at: STORED_AT + 90_000 },
  timeZone: NEW_YORK,
} as RoutineLog

const NEW_LOG = {
  log: undefined,
  kind: 'weekly' as const,
  hasDurationField: true,
  startedAt: NOW - 30 * MINUTE_MS,
  isStartUntouched: true,
  duration: durationBoxesOf('weekly', 30),
  isDurationUntouched: true,
  zone: KOLKATA,
  now: NOW,
}

const EDITED = { ...NEW_LOG, log: STORED, startedAt: STORED_AT }

describe('parseLogDraft', () => {
  it('keeps an untouched stored start and length exactly', () => {
    const { fields, changedLengthMs } = parseLogDraft(EDITED)
    expect(fields).toEqual(STORED)
    expect(changedLengthMs).toBeUndefined()
    // A clock set back since: the stored log now ends ahead of it, and the save keeps it anyway.
    expect(parseLogDraft({ ...EDITED, now: STORED_AT - 10 * MINUTE_MS }).fields).toEqual(STORED)
  })

  it('sets a length only once the duration is changed, on a form that has one', () => {
    expect(parseLogDraft({ ...EDITED, isDurationUntouched: false }).changedLengthMs).toBe(
      30 * MINUTE_MS,
    )
    // A moved start keeps the stored length, which the server takes from the stored log.
    expect(parseLogDraft({ ...EDITED, isStartUntouched: false }).changedLengthMs).toBeUndefined()
    const noField = { ...EDITED, hasDurationField: false, isDurationUntouched: false }
    expect(parseLogDraft(noField).changedLengthMs).toBeUndefined()
  })

  it('restamps a moved start with the form zone and keeps the length', () => {
    const startedAt = STORED_AT - 5 * MINUTE_MS
    expect(parseLogDraft({ ...EDITED, startedAt, isStartUntouched: false }).fields).toEqual({
      started: { at: startedAt, atLocal: toLocal(startedAt, KOLKATA) },
      ended: { at: startedAt + 90_000 },
      timeZone: KOLKATA,
    })
    // A stored log with no length keeps it while the boxes are untouched.
    const lengthless = { ...STORED, ended: { at: STORED_AT } }
    const moved = parseLogDraft({ ...EDITED, log: lengthless, startedAt, isStartUntouched: false })
    expect(moved.durationError).toBeUndefined()
    expect(moved.fields).toEqual(expect.objectContaining({ ended: { at: startedAt } }))
  })

  it('keeps a stored length over the interval until the start moves', () => {
    const stored = { ...STORED, ended: { at: STORED_AT + 7 * DAY_MS + MINUTE_MS } }
    const kept = { ...EDITED, log: stored, now: stored.ended.at }
    expect(parseLogDraft(kept).fields).toEqual(stored)
    const moved = parseLogDraft({ ...kept, isStartUntouched: false })
    expect(moved.durationError).toBe('A log can be at most 7 days long')
    expect(moved.fields).toBeUndefined()
  })

  it('allows the current minute and refuses the future, on the field that set it', () => {
    expect(parseLogDraft({ ...NEW_LOG, startedAt: NOW - 29 * MINUTE_MS }).fields).toBeDefined()
    const endAhead = parseLogDraft({ ...NEW_LOG, startedAt: NOW - 28 * MINUTE_MS })
    expect(endAhead.startError).toBeUndefined()
    expect(endAhead.durationError).toBe('A log cannot end in the future')
    const startAhead = parseLogDraft({ ...NEW_LOG, startedAt: NOW + 2 * MINUTE_MS })
    expect(startAhead.startError).toBe('A log cannot start in the future')
    expect(startAhead.durationError).toBeUndefined()
  })
})
