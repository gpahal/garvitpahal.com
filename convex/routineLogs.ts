import { ConvexError, v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { cappedValidator, requireDoc, storedRoutines, takeCapped } from './lib/documents'
import type { Capped } from './lib/documents'
import { ownerMutation, ownerQuery } from './lib/functionBuilders'
import { deleteLog, readNote, writeNote } from './lib/logRows'
import { logTotalsValidator, NO_LOG_TOTALS, readLogTotals } from './lib/routineLogAggregate'
import {
  assertDayList,
  assertInstant,
  assertNotFuture,
  assertQueryDay,
  assertReading,
  cleanOptionalText,
  dayListArgs,
  isAhead,
} from './lib/validate'
import { routineValidator } from './routines'
import schema from './schema'
import { isActive, logDurationIssue, logLengthIssue, spanMs } from './shared/goalRules'
import type { IntervalKind } from './shared/goalRules'
import { intervalOfDay } from './shared/intervals'
import type { TimeRange } from './shared/intervals'
import {
  INTERVAL_LOGS_READ,
  LOG_ENDS_AHEAD_ISSUE,
  LOG_TOO_EARLY_ISSUE,
  MAX_NOTE_LENGTH,
} from './shared/limits'

const logValidator = schema.doc('routineLogs')
const logFieldsValidator = logValidator.pick('started', 'ended', 'timeZone')

/**
 * The note is sent with its log but stored in a row of its own.
 */
const logArgs = { ...logFieldsValidator.fields, note: v.optional(v.string()) }

const notedLogValidator = logValidator.extend({ note: v.optional(v.string()) })

/**
 * Without notes: only `forDialog` reads one.
 */
const logListValidator = cappedValidator(logValidator)

type LogFields = typeof logFieldsValidator.type

/**
 * Asked only of a span a save sets: a stored one stays as written, so a goal changed since refuses
 * no note-only edit.
 */
function assertSpan(fields: LogFields, kind: IntervalKind): void {
  assertInstant(fields.started.at, 'Start time')
  assertInstant(fields.ended.at, 'End time')
  if (fields.ended.at < fields.started.at) {
    throw new ConvexError('A log cannot end before it starts')
  }
  const lengthIssue = logLengthIssue(kind, spanMs(fields))
  if (lengthIssue !== undefined) {
    throw new ConvexError(lengthIssue)
  }
}

function assertDurationGiven(routine: Doc<'routines'>, lengthMs: number): void {
  const issue = logDurationIssue(routine.goal.minutesEach !== undefined, lengthMs)
  if (issue !== undefined) {
    throw new ConvexError(issue)
  }
}

function cleanNote(note: string | undefined): string | undefined {
  return cleanOptionalText(note, MAX_NOTE_LENGTH, 'A note')
}

/**
 * Newest first, so a cut list keeps the latest.
 */
async function intervalLogs(
  ctx: QueryCtx,
  routineId: Id<'routines'>,
  { start, end }: TimeRange,
): Promise<Capped<Doc<'routineLogs'>>> {
  return takeCapped(
    ctx.db
      .query('routineLogs')
      .withIndex('by_routineId_and_started_atLocal', (q) =>
        q.eq('routineId', routineId).gte('started.atLocal', start).lt('started.atLocal', end),
      )
      .order('desc'),
    INTERVAL_LOGS_READ,
  )
}

const dialogReadValidator = v.object({
  routine: routineValidator,
  ...logListValidator.fields,
  totals: logTotalsValidator,
  log: v.optional(notedLogValidator),
})

const goneValidator = v.union(v.literal('routine'), v.literal('log'))

/**
 * The log dialog's one read, so its logs are measured against the goal they were read for and a
 * correction never opens before its note. The corrected log is read by id, so it is there even
 * outside the capped rows or the interval. An archived routine stays readable for corrections.
 */
export const forDialog = ownerQuery({
  args: { routineId: v.id('routines'), day: v.number(), logId: v.optional(v.id('routineLogs')) },
  returns: v.union(dialogReadValidator, v.object({ gone: goneValidator })),
  handler: async (ctx, { routineId, day, logId }) => {
    assertQueryDay(day)
    const routine = await ctx.db.get('routines', routineId)
    if (!routine) {
      return { gone: 'routine' as const }
    }
    const interval = intervalOfDay(routine.goal.kind, day)
    const [capped, log] = await Promise.all([
      intervalLogs(ctx, routineId, interval),
      logId && notedLog(ctx, logId),
    ])
    if (log === null) {
      return { gone: 'log' as const }
    }
    if (log && log.routineId !== routineId) {
      throw new ConvexError('This log belongs to another routine')
    }
    // Rows that were not cut are the whole interval already, so only a cut read asks the aggregate.
    const totals = capped.hasMore
      ? ((await readLogTotals(ctx, [{ routineId, interval }]))[0] ?? NO_LOG_TOTALS)
      : {
          count: capped.rows.length,
          loggedMs: capped.rows.reduce((sum, row) => sum + spanMs(row), 0),
        }
    return { routine, totals, ...capped, log }
  },
})

/**
 * `null` once it is deleted.
 */
async function notedLog(
  ctx: QueryCtx,
  id: Id<'routineLogs'>,
): Promise<typeof notedLogValidator.type | null> {
  const [log, note] = await Promise.all([ctx.db.get('routineLogs', id), readNote(ctx, id)])
  return log && { ...log, note }
}

/**
 * Every routine's logs started within a day's local range, newest first. Logs of a deleted routine
 * are returned until its drain removes them.
 */
export const listForRange = ownerQuery({
  args: dayListArgs,
  returns: logListValidator,
  handler: async (ctx, { start, end, limit }) => {
    assertDayList({ start, end, limit })
    return takeCapped(
      ctx.db
        .query('routineLogs')
        .withIndex('by_started_atLocal', (q) =>
          q.gte('started.atLocal', start).lt('started.atLocal', end),
        )
        .order('desc'),
      limit,
    )
  },
})

const totalsValidator = v.object({
  routineId: v.id('routines'),
  ...logTotalsValidator.fields,
})

/**
 * Each active routine's totals over its goal's interval around `day`. The browser works the interval
 * out again from `routines.list` (`trackRoutines` says why the two agree).
 */
export const totalsByRoutine = ownerQuery({
  args: { day: v.number() },
  returns: v.array(totalsValidator),
  handler: async (ctx, { day }) => {
    assertQueryDay(day)
    const routines = await storedRoutines(ctx)
    const intervals = routines.filter(isActive).map((routine) => ({
      routineId: routine._id,
      interval: intervalOfDay(routine.goal.kind, day),
    }))
    const totals = await readLogTotals(ctx, intervals)
    return intervals.map(({ routineId }, i) => ({ routineId, ...(totals[i] ?? NO_LOG_TOTALS) }))
  },
})

export const create = ownerMutation({
  args: { routineId: v.id('routines'), ...logArgs },
  returns: v.id('routineLogs'),
  handler: async (ctx, { routineId, note, ...fields }) => {
    // First, so a stale tab hears that its routine is gone, not of its reading.
    const routine = await requireDoc(ctx, 'routines', routineId)
    if (!isActive(routine)) {
      throw new ConvexError('This routine is archived. Restore it to log it')
    }
    assertSpan(fields, routine.goal.kind)
    assertDurationGiven(routine, spanMs(fields))
    const cleanedNote = cleanNote(note)
    assertReading(fields.started, fields.timeZone, 'Start time', LOG_TOO_EARLY_ISSUE)
    // Bounds the start too, which `assertSpan` keeps at or before the end.
    assertNotFuture(fields.ended.at)
    const id = await ctx.db.insert('routineLogs', { routineId, ...fields })
    if (cleanedNote !== undefined) {
      await writeNote(ctx, id, cleanedNote)
    }
    return id
  },
})

/**
 * What is left out is left alone, and an empty note clears it. A start travels with its zone as
 * `reading`. A length is sent rather than an end, so two tabs editing the start and the length
 * combine rather than produce a span neither asked for.
 */
export const update = ownerMutation({
  args: {
    id: v.id('routineLogs'),
    reading: v.optional(logFieldsValidator.pick('started', 'timeZone')),
    lengthMs: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { id, reading, lengthMs, note }) => {
    const log = await requireDoc(ctx, 'routineLogs', id)
    const routine = await requireDoc(ctx, 'routines', log.routineId)
    const cleanedNote = note === undefined ? undefined : cleanNote(note)
    // No list reads a note, so a note-only edit leaves the row and its lists alone.
    if (reading || lengthMs !== undefined) {
      // A negative length is `assertSpan`'s to refuse, as an end before the start.
      if (lengthMs !== undefined && !Number.isSafeInteger(lengthMs)) {
        throw new ConvexError('Length is not a whole number of milliseconds')
      }
      const started = reading?.started ?? log.started
      const fields = {
        started,
        timeZone: reading?.timeZone ?? log.timeZone,
        ended: { at: started.at + (lengthMs ?? spanMs(log)) },
      }
      assertSpan(fields, routine.goal.kind)
      if (lengthMs !== undefined) {
        assertDurationGiven(routine, lengthMs)
      }
      if (reading) {
        assertReading(fields.started, fields.timeZone, 'Start time', LOG_TOO_EARLY_ISSUE)
      }
      // An end ahead can come of another tab's start or length, so it gets the form's words, not
      // the clock's.
      assertNotFuture(fields.started.at)
      if (isAhead(fields.ended.at)) {
        throw new ConvexError(LOG_ENDS_AHEAD_ISSUE)
      }
      // An unchanged save writes nothing, so it neither fires the aggregate trigger nor re-runs
      // the subscriptions that read the row.
      const isUnchanged =
        fields.started.at === log.started.at &&
        fields.started.atLocal === log.started.atLocal &&
        fields.timeZone === log.timeZone &&
        fields.ended.at === log.ended.at
      if (!isUnchanged) {
        await ctx.db.patch('routineLogs', id, fields)
      }
    }
    if (note !== undefined) {
      await writeNote(ctx, id, cleanedNote)
    }
    return null
  },
})

export const remove = ownerMutation({
  args: { id: v.id('routineLogs') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    // Already gone is not an error. A log whose routine is deleted goes as the drain would take it.
    if (await ctx.db.get('routineLogs', id)) {
      await deleteLog(ctx, id)
    }
    return null
  },
})
