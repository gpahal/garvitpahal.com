import { setTimer } from '@/lib/timers'
import type { SetTimer } from '@/lib/timers'

import type { PuzzleId } from '../puzzles/registry'
import { UserFacingError } from '../user-facing-error'
import { OPERATIONS } from './protocol'
import type { Job, JobReply, Operation, Operations, WorkerMessage } from './protocol'

type Transport = {
  postMessage: (job: Job) => void
  terminate: () => void
  addEventListener: {
    (type: 'message', listener: (event: MessageEvent<WorkerMessage>) => void): void
    (type: 'error' | 'messageerror', listener: () => void): void
  }
}

/**
 * The job never started: the Worker's script failed (a CSP refusal, no module Workers, a chunk gone
 * after a deploy) or the time limit ran out first. Another job would fail the same way, so it asks
 * for a reload rather than a retry.
 */
export class WorkerStartError extends UserFacingError {
  override name = 'WorkerStartError'

  constructor(operation: Operation, options?: ErrorOptions) {
    super(OPERATIONS[operation].startFailure, { reload: true, noRetry: true }, options)
  }
}

function cancelled(): DOMException {
  return new DOMException('Processing was cancelled', 'AbortError')
}

/**
 * Lets a job past its compute budget return the solver's timeout result, which keeps what it found,
 * before the Worker is terminated.
 */
const COOPERATIVE_TIMEOUT_ALLOWANCE_MS = 500

/**
 * Spans the initial phase's model calls between a read's jobs; a Worker ended sooner costs only a
 * restart.
 */
const IDLE_LIMIT_MS = 60_000

type Pending = {
  id: number
  onStarted: (id: number) => void
  onReply: (reply: JobReply) => void
  onCrash: () => void
  cancel: () => void
}

/**
 * One job at a time on one Worker, kept between jobs. Only termination interrupts synchronous
 * computation, so a cancelled, timed-out or crashed job takes its Worker with it and any late reply
 * is dropped. A limit or crash before the Worker reports `started` is a `WorkerStartError`; an abort
 * rejects with an `AbortError`, which the caller ignores.
 */
export class ProcessingJobs {
  private worker?: Transport
  private pending?: Pending
  private nextId = 0
  private cancelIdle?: () => void

  constructor(
    private readonly create: () => Transport,
    private readonly schedule: SetTimer = setTimer,
  ) {}

  private acquire(): Transport {
    this.cancelIdle?.()
    this.cancelIdle = undefined
    if (this.worker) return this.worker
    const worker = this.create()
    worker.addEventListener('message', ({ data: message }) => {
      if (this.worker !== worker) return
      if ('type' in message) this.pending?.onStarted(message.id)
      else this.pending?.onReply(message)
    })
    // Nothing more will come from this Worker. An undeserialisable reply counts too, rather than
    // waiting out the time limit.
    const onCrash = (): void => {
      if (this.worker !== worker) return
      if (this.pending) this.pending.onCrash()
      else this.discard(worker)
    }
    worker.addEventListener('error', onCrash)
    worker.addEventListener('messageerror', onCrash)
    this.worker = worker
    return worker
  }

  private discard(worker: Transport): void {
    worker.terminate()
    if (this.worker !== worker) return
    this.worker = undefined
    this.cancelIdle?.()
    this.cancelIdle = undefined
  }

  private keepIdle(worker: Transport): void {
    this.cancelIdle?.()
    this.cancelIdle = this.schedule(() => {
      this.cancelIdle = undefined
      if (!this.pending) this.discard(worker)
    }, IDLE_LIMIT_MS)
  }

  cancel(): void {
    this.pending?.cancel()
  }

  dispose(): void {
    this.cancel()
    if (this.worker) this.discard(this.worker)
  }

  async run<K extends Operation, TId extends PuzzleId = PuzzleId>(
    operation: K,
    data: Operations<NoInfer<TId>>[K]['input'] &
      (K extends 'prepare' | 'assess' | 'solve' ? { puzzleId: TId } : unknown),
    signal?: AbortSignal,
  ): Promise<Operations<TId>[K]['output']> {
    this.cancel()
    if (signal?.aborted) throw cancelled()
    const id = ++this.nextId
    const timing: (typeof OPERATIONS)[Operation] = OPERATIONS[operation]
    type Output = Operations<TId>[K]['output']
    return new Promise<Output>((resolve, reject) => {
      let worker: Transport
      try {
        worker = this.acquire()
      } catch (error) {
        reject(new WorkerStartError(operation, { cause: error }))
        return
      }
      let isStarted = false
      const finish = (isTerminating: boolean): void => {
        cancelTimer()
        if (this.pending?.id === id) this.pending = undefined
        signal?.removeEventListener('abort', stop)
        if (isTerminating) this.discard(worker)
        else if (this.worker === worker && !this.pending) this.keepIdle(worker)
      }
      const stop = (): void => {
        finish(true)
        reject(cancelled())
      }
      const timedOut = (): void => {
        finish(true)
        const { onTimeout } = timing
        if (!isStarted) reject(new WorkerStartError(operation))
        else if ('result' in onTimeout) resolve(onTimeout.result)
        else reject(new UserFacingError(onTimeout.message))
      }
      let cancelTimer = this.schedule(timedOut, timing.limitMs)
      this.pending = {
        id,
        onStarted: (startedId) => {
          if (startedId !== id) return
          isStarted = true
          if (!('budgetMs' in timing)) return
          cancelTimer()
          cancelTimer = this.schedule(timedOut, timing.budgetMs + COOPERATIVE_TIMEOUT_ALLOWANCE_MS)
        },
        onReply: (reply) => {
          if (reply.id !== id) return
          finish(false)
          // The Worker runs this bundle's registry and sends only messages written for the owner.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the operation determines the output
          if (reply.ok) resolve(reply.result as Output)
          else reject(new UserFacingError(reply.failure.message, reply.failure))
        },
        onCrash: () => {
          finish(true)
          reject(isStarted ? new UserFacingError(timing.failure) : new WorkerStartError(operation))
        },
        cancel: stop,
      }
      signal?.addEventListener('abort', stop, { once: true })
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- `data` is `operation`'s input
        worker.postMessage({ id, operation, data } as Job)
      } catch (error) {
        // Such as a `DataCloneError`, whose own message means nothing to the user.
        finish(true)
        reject(new UserFacingError(timing.failure, {}, { cause: error }))
      }
    })
  }
}
