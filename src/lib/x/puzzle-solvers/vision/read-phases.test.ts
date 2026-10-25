import { describe, expect, it } from 'vitest'

import type { Remedy } from '@/lib/failure'

import type { ExtractFailure, ExtractOutcome } from './extract-client'
import { READ_DEADLINE_MS, readPhases } from './read-phases'

const read = { ok: true, puzzle: 'puzzle' } as const

function failed(message: string, remedy: Remedy = {}): ExtractFailure {
  return { ok: false, error: { message, ...remedy } }
}

const recoverable = failed('Unreadable', { fallback: true })
const refused = failed('Refused', { fallback: true, noRetry: true })
const alsoRefused = failed('Also refused', { noRetry: true })
const reload = failed('Reload', { reload: true, noRetry: true })
const bare = failed('No remedy')
const aborted = new DOMException('Aborted', 'AbortError')

/**
 * `answers` are in the order `initial0`, `initial1`, `fallback0`.
 */
function run(
  answers: Array<() => Promise<ExtractOutcome<string>>>,
  onRead: () => Promise<void> = async () => undefined,
  isStopped: () => boolean = () => false,
) {
  const requests: Array<string> = []
  const result = readPhases<string>({
    deadline: READ_DEADLINE_MS,
    now: () => 0,
    isStopped,
    read: async (phase, call) => {
      requests.push(`${phase}${String(call)}`)
      return answers[phase === 'initial' ? call : 2]!()
    },
    onRead,
  })
  return { requests, result }
}

describe('read phases', () => {
  it.each([
    ['every initial call recoverable', [recoverable, recoverable, recoverable], recoverable, true],
    ['a refusal beside a read', [read, alsoRefused], alsoRefused, false],
    ['a reload beside a read', [read, reload], reload, false],
    ['a failure with no remedy beside a read', [read, bare], bare, false],
    [
      'a refusal, then a failure allowing Try again',
      [refused, refused, recoverable],
      refused,
      true,
    ],
    ['a refusal, then another refusal', [refused, refused, alsoRefused], alsoRefused, true],
    ['a refusal, then a fallback read', [refused, refused, read], refused, true],
  ] as const)(
    'after %s, picks the fallback and failure',
    async (_label, outcomes, failure, buys) => {
      const { requests, result } = run(outcomes.map((outcome) => async () => outcome))
      expect(await result).toEqual({ failure })
      expect(requests).toEqual(['initial0', 'initial1', ...(buys ? ['fallback0'] : [])])
    },
  )

  it('buys no fallback once an initial read is trusted', async () => {
    let trusted = false
    const { requests, result } = run(
      [async () => read, async () => recoverable],
      async () => {
        trusted = true
      },
      () => trusted,
    )
    expect(await result).toEqual({})
    expect(requests).toEqual(['initial0', 'initial1'])
  })

  it('ends the phase at a rejection without waiting for the other call, handling its own', async () => {
    const pending = Promise.withResolvers<ExtractOutcome<string>>()
    const { result } = run([async () => read, async () => pending.promise], async () => {
      throw aborted
    })
    expect(await result).toEqual({ rejected: { error: aborted } })
    pending.reject(new DOMException('Aborted', 'AbortError'))
    await new Promise((resolve) => setImmediate(resolve))
  })

  it('keeps the failure and wait a call met before a rejection ended the phase', async () => {
    const pending = Promise.withResolvers<ExtractOutcome<string>>()
    const limited: ExtractFailure = { ...failed('Limited'), retryAt: 7000 }
    const { result } = run([async () => limited, async () => pending.promise])
    await new Promise((resolve) => setImmediate(resolve))
    pending.reject(aborted)
    expect(await result).toEqual({ failure: limited, retryAt: 7000, rejected: { error: aborted } })
  })
})
