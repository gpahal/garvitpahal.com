import { useEffect, useState } from 'react'

import type { ProcessingJobs } from '@/lib/x/puzzle-solvers/processing/jobs'
import type { Operations } from '@/lib/x/puzzle-solvers/processing/protocol'

type PictureOperation = 'decode' | 'detect'

type JobResult<TOutput> = { ok: true; output: TOutput } | { ok: false; error: unknown }

/**
 * `data` must keep its identity between renders (`useMemo`): a new object aborts the old job and
 * starts another. `undefined` aborts it and drops the last result.
 */
export function useJob<K extends PictureOperation>(
  jobs: ProcessingJobs,
  operation: K,
  data: Operations[K]['input'] | undefined,
): JobResult<Operations[K]['output']> | undefined {
  const [settled, setSettled] = useState<{
    data: Operations[K]['input']
    result: JobResult<Operations[K]['output']>
  }>()
  if (data === undefined && settled !== undefined) {
    setSettled(undefined)
  }
  useEffect(() => {
    if (data === undefined) return
    const controller = new AbortController()
    const settle = (result: JobResult<Operations[K]['output']>): void => {
      if (!controller.signal.aborted) setSettled({ data, result })
    }
    // `run`'s puzzle condition does not resolve for a generic `K`; `operation` still decides the
    // output.
    void jobs
      .run<PictureOperation>(operation, data, controller.signal)
      .then((output) => {
        settle({ ok: true, output: output as Operations[K]['output'] })
      })
      .catch((error: unknown) => {
        settle({ ok: false, error })
      })
    return () => {
      controller.abort()
    }
  }, [jobs, operation, data])
  return settled !== undefined && settled.data === data ? settled.result : undefined
}
