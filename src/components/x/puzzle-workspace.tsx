import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { downscaleToJpeg } from '@/lib/capture/downscale'
import { PUZZLES, type PuzzleId } from '@/puzzles/registry'
import { indexOf, type SudokuGrid, type SudokuSolution } from '@/puzzles/sudoku/model'
import type { CellRef, SolveResult } from '@/puzzles/types'
import { PUZZLE_UI } from '@/puzzles/ui-registry'

import { CapturePane } from './capture/capture-pane'

const SOLVE_TIMEOUT_MS = 3000

/** Tenths, so the readout visibly moves. Whole seconds look frozen on a fast extraction. */
const TIMER_TICK_MS = 100

type WorkspaceProps = {
  puzzleId: PuzzleId
}

type Status = 'idle' | 'extracting' | 'reviewing'

const BUTTON =
  'unstyled inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:ring-anchor focus-visible:outline-none focus-visible:ring-2'

/**
 * The single hydrated island. Astro cannot hydrate a component resolved dynamically from a registry,
 * so this is statically imported and switches on `puzzleId` internally.
 */
export function PuzzleWorkspace({ puzzleId }: WorkspaceProps): ReactNode {
  const definition = PUZZLES[puzzleId]
  const { Editor, Solution } = PUZZLE_UI[puzzleId]

  const [status, setStatus] = useState<Status>('idle')
  const [grid, setGrid] = useState<SudokuGrid | undefined>(undefined)
  const [uncertain, setUncertain] = useState<Array<CellRef>>([])
  const [solveResult, setSolveResult] = useState<SolveResult<SudokuSolution> | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [extractStartedAt, setExtractStartedAt] = useState<number | undefined>(undefined)
  const elapsedMs = useElapsedMs(extractStartedAt)

  const onImage = useCallback(
    async (image: Blob) => {
      setStatus('extracting')
      setExtractStartedAt(Date.now())
      setError(undefined)
      setSolveResult(undefined)
      // Otherwise a failed read keeps the previous puzzle's review state alive behind the error.
      setGrid(undefined)
      setUncertain([])

      try {
        const downscaled = await downscaleToJpeg(image, definition.maxImageEdge)
        const response = await definition.extract(downscaled)
        if (response.ok) {
          setGrid(response.puzzle)
          setUncertain(response.uncertain)
          setStatus('reviewing')
        } else {
          setError(response.error.message)
          setStatus('idle')
        }
      } catch {
        setError('Could not read that image. Try another picture.')
        setStatus('idle')
      } finally {
        setExtractStartedAt(undefined)
      }
    },
    [definition],
  )

  const onEdit = useCallback(
    (next: SudokuGrid) => {
      // A cell the user has typed into has been reviewed, so it stops being flagged.
      setUncertain((previous) =>
        // A resize re-indexes every cell, so the old refs would point at unrelated ones.
        next.n === grid?.n
          ? previous.filter(({ row, col }) => {
              const index = indexOf(next.n, row, col)
              return next.values[index] === grid.values[index]
            })
          : [],
      )
      setGrid(next)
      // Any edit invalidates the previous solve.
      setSolveResult(undefined)
    },
    [grid],
  )

  const onSolve = useCallback(() => {
    if (grid) {
      setSolveResult(definition.solve(grid, { timeoutMs: SOLVE_TIMEOUT_MS }))
    }
  }, [definition, grid])

  const onManualEntry = useCallback(() => {
    setGrid(definition.blank())
    setUncertain([])
    setSolveResult(undefined)
    setError(undefined)
    setStatus('reviewing')
  }, [definition])

  const onReset = useCallback(() => {
    setGrid(undefined)
    setUncertain([])
    setSolveResult(undefined)
    setError(undefined)
    setStatus('idle')
  }, [])

  return (
    <div className="flex flex-col gap-5">
      {status === 'idle' || status === 'extracting' ? (
        <div className="flex flex-col gap-3">
          <CapturePane
            onImage={(image) => void onImage(image)}
            disabled={status === 'extracting'}
          />
          {status === 'extracting' ? (
            <p className="unstyled my-0! text-center text-sm text-gray-11">
              {/* Only the sentence is a live region: announcing the timer would never stop. */}
              <span role="status">Reading the puzzle...</span>{' '}
              <span aria-hidden="true" className="tabular-nums">
                {(elapsedMs / 1000).toFixed(1)}s
              </span>
            </p>
          ) : (
            <p className="unstyled my-0! text-center text-sm text-gray-11">
              or{' '}
              <button
                type="button"
                onClick={onManualEntry}
                className="unstyled text-anchor underline underline-offset-2"
              >
                enter it manually
              </button>
            </p>
          )}
          {error ? (
            <p role="alert" className="unstyled my-0! text-center text-sm text-gray-12">
              {error}
            </p>
          ) : undefined}
        </div>
      ) : undefined}

      {status === 'reviewing' && grid ? (
        <div className="flex flex-col gap-4">
          <ReviewBanner uncertainCount={uncertain.length} result={solveResult} />

          {solveResult?.status === 'solved' || solveResult?.status === 'multiple' ? (
            <Solution grid={grid} solution={solveResult.solution} />
          ) : (
            <Editor grid={grid} uncertain={uncertain} onChange={onEdit} />
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {solveResult?.status === 'solved' || solveResult?.status === 'multiple' ? (
              <button
                type="button"
                onClick={() => {
                  setSolveResult(undefined)
                }}
                className={`${BUTTON} border border-gray-6 text-gray-12 hocus:bg-gray-4`}
              >
                Back to editing
              </button>
            ) : (
              <button
                type="button"
                onClick={onSolve}
                className={`${BUTTON} bg-gray-12 text-gray-contrast hocus:bg-gray-11`}
              >
                Solve
              </button>
            )}
            <button
              type="button"
              onClick={onReset}
              className={`${BUTTON} border border-gray-6 text-gray-12 hocus:bg-gray-4`}
            >
              Start over
            </button>
          </div>
        </div>
      ) : undefined}
    </div>
  )
}

/**
 * Extraction has no progress to report, so a moving number is the only signal it has not hung. The
 * clock is state and the interval only re-reads it, keeping `setState` out of the effect body.
 */
function useElapsedMs(startedAt: number | undefined): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (startedAt === undefined) {
      return
    }

    const id = setInterval(() => {
      setNow(Date.now())
    }, TIMER_TICK_MS)
    return () => {
      clearInterval(id)
    }
  }, [startedAt])

  // `now` is from the previous run until the first tick lands, so it can trail `startedAt`.
  return startedAt === undefined ? 0 : Math.max(0, now - startedAt)
}

/**
 * `unsolvable` and `multiple` almost always mean the picture was misread rather than that the puzzle
 * is unusual, so the copy points at the grid rather than blaming the solver.
 */
function ReviewBanner({
  uncertainCount,
  result,
}: {
  uncertainCount: number
  result: SolveResult<SudokuSolution> | undefined
}): ReactNode {
  let message: string | undefined
  let tone: 'info' | 'warn' = 'info'

  switch (result?.status) {
    case 'unsolvable': {
      message =
        'This grid has no solution, which usually means a digit was read wrong. Check the highlighted cells and try again.'
      tone = 'warn'

      break
    }
    case 'multiple': {
      message =
        'This grid has more than one solution, so some givens are probably missing. One valid solution is shown below.'
      tone = 'warn'

      break
    }
    case 'timeout': {
      message =
        'Solving timed out. That usually points to a misread digit rather than a hard puzzle.'
      tone = 'warn'

      break
    }
    case 'solved': {
      message = undefined

      break
    }
    default: {
      message =
        uncertainCount > 0
          ? `Check ${String(uncertainCount)} highlighted ${
              uncertainCount === 1 ? 'cell' : 'cells'
            } before solving.`
          : 'Check the grid matches your puzzle, then solve.'
    }
  }

  if (!message) {
    return undefined
  }

  return (
    <p
      role={tone === 'warn' ? 'alert' : undefined}
      className={`unstyled my-0! rounded-md px-3 py-2 text-sm ${
        tone === 'warn' ? 'bg-gray-4 text-gray-12' : 'bg-gray-3 text-gray-11'
      }`}
    >
      {message}
    </p>
  )
}
