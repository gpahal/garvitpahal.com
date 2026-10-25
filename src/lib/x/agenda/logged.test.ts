import { describe, expect, it } from 'vitest'

import { toLocal } from '@convex/shared/localTime'

import { isReadFurther, mergeLogged } from './logged'
import type { LoggedEntry } from './logged'

function log(id: string, at: number): { _id: string; started: { at: number; atLocal: number } } {
  return { _id: id, started: { at, atLocal: at } }
}

function task(id: string, at: number): { _id: string; done: { at: number; atLocal: number } } {
  return { _id: id, done: { at, atLocal: at } }
}

describe('mergeLogged', () => {
  it('interleaves routine logs and completed tasks by local reading, newest first', () => {
    const merged = mergeLogged([log('l2', 40), log('l1', 10)], [task('t1', 30), task('t2', 5)])
    expect(merged.map((entry) => [entry.kind, entry.at])).toEqual([
      ['log', 40],
      ['task', 30],
      ['log', 10],
      ['task', 5],
    ])
  })

  it('stops short of the last row of a source that was cut, which is as far back as it is whole', () => {
    const logs = [log('l2', 20), log('l1', 10)]
    const tasks = [task('t3', 30), task('t2', 15), task('t1', 5)]
    const shown = (cut: { logs: boolean; tasks: boolean }): Array<string> =>
      mergeLogged(logs, tasks, cut).map((entry) =>
        entry.kind === 'log' ? entry.log._id : entry.task._id,
      )
    expect(shown({ logs: true, tasks: false })).toEqual(['t3', 'l2', 't2'])
    expect(shown({ logs: false, tasks: true })).toEqual(['t3', 'l2', 't2', 'l1'])
    expect(shown({ logs: true, tasks: true })).toEqual(['t3', 'l2', 't2'])
    expect(shown({ logs: false, tasks: false })).toEqual(['t3', 'l2', 't2', 'l1', 't1'])
  })

  it('holds back every row sharing the reading a source was cut at', () => {
    // Read in another zone, so an unread log with this reading can have happened after both.
    const logs = [{ _id: 'l1', started: { at: 5, atLocal: 20 } }]
    const tasks = [task('t2', 30), task('t1', 20)]
    const shown = mergeLogged(logs, tasks, { logs: true, tasks: false })
    expect(shown.map((entry) => entry.at)).toEqual([30])
    expect(mergeLogged(logs, tasks).map((entry) => entry.at)).toEqual([30, 20, 5])
  })

  it('only adds rows below when more is read across a clocks-back repeat', () => {
    const zone = 'America/New_York'
    const at = (utc: number) => ({ at: utc, atLocal: toLocal(utc, zone) })
    // 100 logs from 01:50:00 EDT a second apart, then one at 01:10 EST: later, but an earlier reading.
    const edt = Array.from({ length: 100 }, (_, index) => ({
      _id: `edt${index}`,
      started: at(Date.UTC(2026, 10, 1, 5, 50, index)),
    }))
    const est = { _id: 'est', started: at(Date.UTC(2026, 10, 1, 6, 10)) }
    // As the server reads them: newest reading first, capped at the limit.
    const stored = [...edt, est].toSorted((a, b) => b.started.atLocal - a.started.atLocal)
    const ids = (entries: Array<LoggedEntry<{ _id: string }, unknown>>) =>
      entries.map((entry) => (entry.kind === 'log' ? entry.log._id : 'task'))
    const first = ids(mergeLogged(stored.slice(0, 100), [], { logs: true, tasks: false }))
    const more = ids(mergeLogged(stored, []))
    expect(first).toHaveLength(99)
    expect(more.slice(0, first.length)).toEqual(first)
    expect(more.at(-1)).toBe('est')
  })
})

describe('isReadFurther', () => {
  const read = (length: number, hasMore: boolean) => ({
    rows: Array.from({ length }, (_, index) => index),
    hasMore,
  })

  it('reads further a source cut short of the most one read may ask for', () => {
    expect(isReadFurther(read(100, true), 1000)).toBe(true)
  })

  it('reads no further a source cut at the most one read may ask for, or not cut', () => {
    expect(isReadFurther(read(1000, true), 1000)).toBe(false)
    expect(isReadFurther(read(100, false), 1000)).toBe(false)
  })
})
