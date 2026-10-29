import { describe, expect, it } from 'vitest'

import type { SetTimer } from '@/lib/timers'

import { sudoku } from '../puzzles/sudoku/definition'
import { UserFacingError } from '../user-facing-error'
import { ProcessingJobs, WorkerStartError } from './jobs'
import { OPERATIONS } from './protocol'
import type { Job, WorkerMessage } from './protocol'

const IDLE_LIMIT_MS = 75_000
const ALLOWANCE_MS = 500

function createTransport() {
  type Listener = (event: MessageEvent<WorkerMessage>) => void
  const listeners = new Map<string, Array<Listener>>()
  const posted: Array<Job> = []
  let terminated = 0
  const emit = (type: string, event: MessageEvent<WorkerMessage>): void => {
    const current = listeners.get(type) ?? []
    for (const listener of current) listener(event)
  }
  return {
    posted,
    terminated: () => terminated,
    transport: {
      postMessage: (job: Job): void => {
        posted.push(job)
      },
      terminate: (): void => {
        terminated += 1
      },
      addEventListener: (
        type: 'message' | 'error' | 'messageerror',
        listener: Listener | (() => void),
      ): void => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener])
      },
    },
    send: (data: WorkerMessage): void => {
      emit('message', new MessageEvent('message', { data }))
    },
    fail: (type: 'error' | 'messageerror' = 'error'): void => {
      emit(type, new MessageEvent(type))
    },
  }
}

/**
 * Timers fire only when the test fires them, by their delay.
 */
function createScheduler() {
  const timers: Array<{ ms: number; callback: () => void; live: boolean }> = []
  const schedule: SetTimer = (callback, ms) => {
    const timer = { ms, callback, live: true }
    timers.push(timer)
    return () => {
      timer.live = false
    }
  }
  return {
    schedule,
    live: () => timers.filter((timer) => timer.live).map((timer) => timer.ms),
    fire: (ms: number): void => {
      const timer = timers.find((candidate) => candidate.live && candidate.ms === ms)
      if (!timer) throw new Error(`No live timer for ${ms} ms`)
      timer.live = false
      timer.callback()
    },
  }
}

function setup() {
  const scheduler = createScheduler()
  const transports: Array<ReturnType<typeof createTransport>> = []
  const jobs = new ProcessingJobs(() => {
    const transport = createTransport()
    transports.push(transport)
    return transport.transport
  }, scheduler.schedule)
  const worker = (index = 0): ReturnType<typeof createTransport> => {
    const transport = transports[index]
    if (!transport) throw new Error(`No Worker ${index}`)
    return transport
  }
  return { jobs, scheduler, transports, worker }
}

function track<T>(promise: Promise<T>) {
  const state: { settled: boolean } = { settled: false }
  void promise
    .catch(() => undefined)
    .finally(() => {
      state.settled = true
    })
  return state
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('The job resolved')
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve))
}

const image = { width: 1, height: 1, data: new Uint8ClampedArray(4) }
const puzzle = { puzzleId: 'sudoku', puzzle: sudoku.blank() } as const

describe('ProcessingJobs', () => {
  it('rejects a job that never starts with a WorkerStartError and terminates its Worker', async () => {
    const { jobs, scheduler, worker } = setup()
    const result = jobs.run('detect', { image })
    expect(scheduler.live()).toEqual([OPERATIONS.detect.limitMs])
    scheduler.fire(OPERATIONS.detect.limitMs)
    await expect(result).rejects.toBeInstanceOf(WorkerStartError)
    await expect(result).rejects.toThrow(OPERATIONS.detect.startFailure)
    expect(worker().terminated()).toBe(1)
  })

  it('rearms the limit for the budget and allowance once a budgeted job starts', async () => {
    const { jobs, scheduler, worker } = setup()
    const result = jobs.run('assess', puzzle)
    worker().send({ type: 'started', id: 1 })
    expect(scheduler.live()).toEqual([OPERATIONS.assess.budgetMs + ALLOWANCE_MS])
    scheduler.fire(OPERATIONS.assess.budgetMs + ALLOWANCE_MS)
    await expect(result).resolves.toEqual(OPERATIONS.assess.onTimeout.result)
    expect(worker().terminated()).toBe(1)
  })

  it('resolves with the reply and reuses the Worker for the next job', async () => {
    const { jobs, scheduler, transports, worker } = setup()
    const first = jobs.run('detect', { image })
    worker().send({ id: 1, ok: true, result: undefined })
    await expect(first).resolves.toBeUndefined()
    expect(scheduler.live()).toEqual([IDLE_LIMIT_MS])

    const second = jobs.run('assess', puzzle)
    expect(scheduler.live()).toEqual([OPERATIONS.assess.limitMs])
    worker().send({ id: 2, ok: true, result: { confidence: 'trusted' } })
    await expect(second).resolves.toEqual({ confidence: 'trusted' })
    expect(transports).toHaveLength(1)
    expect(worker().posted.map(({ id, operation }) => [id, operation])).toEqual([
      [1, 'detect'],
      [2, 'assess'],
    ])
    expect(worker().terminated()).toBe(0)
  })

  it('rejects an aborted job with an AbortError and terminates its Worker', async () => {
    const { jobs, scheduler, worker } = setup()
    const controller = new AbortController()
    const result = jobs.run('detect', { image }, controller.signal)
    controller.abort()
    await expect(result).rejects.toHaveProperty('name', 'AbortError')
    expect(worker().terminated()).toBe(1)
    expect(scheduler.live()).toEqual([])
  })

  it('cancels the previous job when a new one starts', async () => {
    const { jobs, transports, worker } = setup()
    const first = jobs.run('detect', { image })
    const second = jobs.run('detect', { image })
    await expect(first).rejects.toHaveProperty('name', 'AbortError')
    expect(worker(0).terminated()).toBe(1)
    expect(transports).toHaveLength(2)
    worker(1).send({ id: 2, ok: true, result: undefined })
    await expect(second).resolves.toBeUndefined()
  })

  it('ignores messages from a replaced Worker', async () => {
    const { jobs, scheduler, worker } = setup()
    void jobs.run('solve', puzzle).catch(() => undefined)
    const second = jobs.run('solve', puzzle)
    const state = track(second)
    worker(0).send({ type: 'started', id: 2 })
    worker(0).send({ id: 2, ok: true, result: { status: 'solved' } })
    worker(0).fail()
    await flush()
    expect(state.settled).toBe(false)
    expect(scheduler.live()).toEqual([OPERATIONS.solve.limitMs])
    expect(worker(1).terminated()).toBe(0)
  })

  it('ignores messages carrying an old id', async () => {
    const { jobs, scheduler, worker } = setup()
    const first = jobs.run('detect', { image })
    worker().send({ id: 1, ok: true, result: undefined })
    await first
    const second = jobs.run('solve', puzzle)
    const state = track(second)
    worker().send({ type: 'started', id: 1 })
    worker().send({ id: 1, ok: true, result: { status: 'solved' } })
    await flush()
    expect(state.settled).toBe(false)
    expect(scheduler.live()).toEqual([OPERATIONS.solve.limitMs])
  })

  it("rejects a crash after start with the operation's failure", async () => {
    const { jobs, worker } = setup()
    const result = jobs.run('solve', puzzle)
    worker().send({ type: 'started', id: 1 })
    worker().fail()
    const error: unknown = await rejection(result)
    expect(error).toBeInstanceOf(UserFacingError)
    expect(error).not.toBeInstanceOf(WorkerStartError)
    expect(error).toHaveProperty('message', OPERATIONS.solve.failure)
    expect(worker().terminated()).toBe(1)
  })
})
