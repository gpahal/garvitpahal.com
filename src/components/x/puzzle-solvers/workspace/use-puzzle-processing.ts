import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch } from 'react'

import { ProcessingJobs } from '@/lib/x/puzzle-solvers/processing/jobs'
import { OPERATIONS } from '@/lib/x/puzzle-solvers/processing/protocol'
import type { PuzzleId, PuzzleOf, RegisteredPuzzle } from '@/lib/x/puzzle-solvers/puzzles/registry'
import { failureOf } from '@/lib/x/puzzle-solvers/user-facing-error'
import { readPicture } from '@/lib/x/puzzle-solvers/vision/read-picture'
import type { RetainedPicture } from '@/lib/x/puzzle-solvers/vision/read-picture'
import type { WorkspaceEvent } from '@/lib/x/puzzle-solvers/workspace-state'

function createJobs(): ProcessingJobs {
  return new ProcessingJobs(
    () =>
      // Relative, since Vite resolves a Worker's `new URL` without the `@/` alias Astro adds.
      new Worker(
        new URL('../../../../lib/x/puzzle-solvers/processing/worker.ts', import.meta.url),
        {
          type: 'module',
        },
      ),
  )
}

/**
 * Each command that ends the job on screen aborts it in the same step as it dispatches. Aborting
 * later, such as in an effect, would leave a render in which a late result lands after an edit.
 */
export function usePuzzleProcessing<TId extends PuzzleId>(
  definition: RegisteredPuzzle<TId>,
  dispatch: Dispatch<WorkspaceEvent<PuzzleOf<TId>>>,
) {
  const [jobs] = useState(createJobs)
  const currentRef = useRef<AbortController | undefined>(undefined)
  const readTokenRef = useRef(0)

  const stop = useCallback(() => {
    currentRef.current?.abort()
    jobs.cancel()
  }, [jobs])
  useEffect(
    () => () => {
      currentRef.current?.abort()
      jobs.dispose()
    },
    [jobs],
  )

  // Stable, since an editor reports its blocker from an effect.
  const commands = useMemo(() => {
    const stopWith = (event: WorkspaceEvent<PuzzleOf<TId>>): void => {
      stop()
      dispatch(event)
    }
    return {
      edit: (puzzle: PuzzleOf<TId>, isContinuingEdit?: boolean) => {
        stopWith({ type: 'edited', puzzle, isContinuingEdit })
      },
      undo: () => {
        stopWith({ type: 'undone' })
      },
      startOver: () => {
        stopWith({ type: 'reset' })
      },
      cancel: () => {
        stopWith({ type: 'cancelled' })
      },
      enterManually: (puzzle: PuzzleOf<TId>) => {
        stopWith({ type: 'manualEntered', puzzle })
      },
      choosePicture: () => {
        stopWith({ type: 'choosePicture' })
      },
      // A half-finished edit ends the job on screen too.
      changeBlocker: (blocker: string | undefined) => {
        if (blocker === undefined) dispatch({ type: 'blockerChanged', blocker })
        else stopWith({ type: 'blockerChanged', blocker })
      },
    }
  }, [stop, dispatch])

  function begin(): AbortSignal {
    stop()
    currentRef.current = new AbortController()
    return currentRef.current.signal
  }

  // `onShow` runs just before the read's puzzle replaces the one on screen.
  async function read(
    picture: RetainedPicture,
    { isRetry, isPuzzleOnScreen }: { isRetry: boolean; isPuzzleOnScreen: boolean },
    onShow: () => void,
  ) {
    const signal = begin()
    const token = ++readTokenRef.current
    dispatch({ type: 'readStarted', token, picture, isRetry, now: Date.now() })
    const result = await readPicture({
      picture,
      isPuzzleOnScreen,
      signal,
      now: () => performance.now(),
      prepare: async (capture, signal) =>
        jobs.run('prepare', { puzzleId: definition.id, capture }, signal),
      read: definition.read,
      assess: async (puzzle, signal) =>
        jobs.run<'assess', TId>('assess', { puzzleId: definition.id, puzzle }, signal),
      onStage: (stage) => {
        dispatch({ type: 'stageChanged', token, stage })
      },
    })
    if (result.status === 'read' || result.status === 'unsolvable') onShow()
    dispatch({ type: 'readEnded', token, result })
    if (result.status !== 'cancelled') stop()
  }

  async function solve(puzzle: PuzzleOf<TId>): Promise<void> {
    const signal = begin()
    dispatch({ type: 'solveStarted' })
    try {
      const result = await jobs.run<'solve', TId>(
        'solve',
        { puzzleId: definition.id, puzzle },
        signal,
      )
      if (!signal.aborted) dispatch({ type: 'solveEnded', result })
    } catch (error) {
      if (!signal.aborted) {
        dispatch({ type: 'solveFailed', failure: failureOf(error, OPERATIONS.solve.failure) })
      }
    } finally {
      if (!signal.aborted) stop()
    }
  }

  return { jobs, read, solve, commands }
}
