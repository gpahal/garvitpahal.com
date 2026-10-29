import { describe, expect, it } from 'vitest'

import { createTestClock } from '@/lib/test-clock'

import { fullFrameQuad } from '../capture/quad'
import { WorkerStartError } from '../processing/jobs'
import { OPERATIONS } from '../processing/protocol'
import type { ReadAssessment } from '../puzzles/types'
import type { ExtractOutcome, PreparedImage } from './extract-client'
import { READ_TIME_LIMIT_MESSAGE } from './extract-wire'
import { finishRead, MISREAD_KEPT_MESSAGE, readPicture } from './read-picture'

const REFUSED_NOTICE =
  'Checking the read could not finish, and trying again would not help. Compare it with the picture'
const UNFINISHED_NOTICE =
  'Checking the read could not finish. Compare it with the picture, or try again'
const UNVERIFIED_NOTICE = 'This read could not be checked. Compare it with the picture'

describe('readPicture', () => {
  const prepared: PreparedImage = { image: 'cGljdHVyZQ==', hints: {} }

  /**
   * A read whose first call reads and whose second stalls until aborted, unless `stall` is false,
   * when it fails in a way the fallback may pass.
   */
  function setup(assess: () => Promise<ReadAssessment>, stall = true) {
    const clock = createTestClock()
    const signals: Array<AbortSignal> = []
    const requests: Array<string> = []
    const result = readPicture<string>({
      picture: {
        capture: {
          image: { width: 2, height: 2, data: new Uint8ClampedArray(16) },
          quad: fullFrameQuad(2, 2),
        },
      },
      isPuzzleOnScreen: false,
      signal: new AbortController().signal,
      prepare: async () => prepared,
      assess,
      read: async (_request, { phase, call, signal }): Promise<ExtractOutcome<string>> => {
        requests.push(`${phase}${String(call)}`)
        signals.push(signal)
        if (call === 0) return { ok: true, puzzle: 'puzzle' }
        if (!stall) return { ok: false, error: { message: 'Unreadable', fallback: true } }
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('', 'AbortError')))
        })
      },
      onStage: () => undefined,
      now: clock.now,
      schedule: clock.setTimer,
    })
    return { clock, signals, requests, result }
  }

  it('stops every request once a read is trusted, and releases its deadline', async () => {
    const run = setup(async () => ({ confidence: 'trusted', fingerprint: 'grid' }))
    expect(await run.result).toEqual({ status: 'read', puzzle: 'puzzle', prepared })
    expect(run.requests).toEqual(['initial0', 'initial1'])
    expect(run.signals.every((signal) => signal.aborted)).toBe(true)
    expect(run.clock.pending()).toBe(0)
  })

  it('keeps a paid read unverified when the Worker cannot start, buying no fallback', async () => {
    const run = setup(async () => {
      throw new WorkerStartError('assess')
    }, false)
    expect(await run.result).toMatchObject({
      status: 'read',
      puzzle: 'puzzle',
      notice: { message: OPERATIONS.assess.startFailure, reload: true, noRetry: true },
    })
    expect(run.requests).toEqual(['initial0', 'initial1'])
  })
})

describe('finishRead', () => {
  const ended = {
    isCancelled: false,
    isTrusted: false,
    isTimedOut: false,
    isStartFailure: false,
    failure: undefined,
    best: undefined,
    lastResort: undefined,
    isPuzzleOnScreen: false,
  }
  const signIn = { message: 'Sign in again in a new tab', signIn: true } as const
  const refused = { message: 'Enter it by hand', noRetry: true } as const
  const passing = { message: 'Unreadable', fallback: true } as const
  const startFailure = { message: OPERATIONS.assess.startFailure, reload: true, noRetry: true }
  const read = (notice?: object) => ({ status: 'read', puzzle: 'read', ...(notice && { notice }) })
  const failed = (failure: object) => ({ status: 'failed', failure })
  const unsolvable = (notice?: object) => ({ status: 'unsolvable', puzzle: 'misread', notice })
  const refusedNotice = { message: REFUSED_NOTICE, noRetry: true }

  it.each([
    [
      'cancellation, over trust',
      { isCancelled: true, isTrusted: true, best: 'read' },
      { status: 'cancelled' },
    ],
    ['a trusted read, over a failure', { isTrusted: true, failure: signIn, best: 'read' }, read()],
    ['an unverified read', { best: 'read' }, read({ message: UNVERIFIED_NOTICE })],
    [
      'a read the Worker could not assess',
      { best: 'read', isStartFailure: true, failure: signIn },
      read(startFailure),
    ],
    ['a read beside a refusal', { best: 'read', failure: refused }, read(refusedNotice)],
    [
      'a read beside a failure the fallback may pass',
      { best: 'read', failure: passing },
      read({ message: UNFINISHED_NOTICE }),
    ],
    [
      'a misread with a puzzle on screen',
      { lastResort: 'misread', isPuzzleOnScreen: true },
      failed({ message: MISREAD_KEPT_MESSAGE }),
    ],
    [
      'a misread beside a refusal',
      { lastResort: 'misread', failure: refused },
      unsolvable(refusedNotice),
    ],
    [
      'a timed-out read',
      { isTimedOut: true, failure: passing },
      failed({ message: READ_TIME_LIMIT_MESSAGE }),
    ],
    ['a failed read', { failure: { ...signIn, fallback: true } }, failed(signIn)],
  ] as const)('ends %s', (_label, input, result) => {
    expect(finishRead<string>({ ...ended, ...input })).toEqual(result)
  })
})
