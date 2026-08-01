import { useCallback, useId, useState, type ReactNode } from 'react'

import { downscaleToJpeg } from '@/lib/capture/downscale'
import { CapturePane } from '@/components/x/capture/capture-pane'
import { ErrorPanel } from '@/components/x/ui/error-panel'
import type { PuzzleDefinition, SolveResult } from '@/puzzles/types'
import type { PuzzleUi } from '@/puzzles/ui-registry'

import { ReviewBanner } from './review-banner'
import { useElapsedMs } from './use-elapsed-ms'

const SOLVE_TIMEOUT_MS = 3000

type Status = 'idle' | 'extracting' | 'reviewing'

const BUTTON =
  'unstyled inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:ring-anchor focus-visible:outline-none focus-visible:ring-2'

type WorkspaceProps<TPuzzle, TSolution> = {
  definition: PuzzleDefinition<TPuzzle, TSolution>
  ui: PuzzleUi<TPuzzle, TSolution>
}

/**
 * Capture, review, solve. Generic over the puzzle: it never inspects one, only hands it back to the
 * definition and to that puzzle's own editor.
 */
export function Workspace<TPuzzle, TSolution>({
  definition,
  ui,
}: WorkspaceProps<TPuzzle, TSolution>): ReactNode {
  const { Editor, Solution } = ui

  const [status, setStatus] = useState<Status>('idle')
  const [puzzle, setPuzzle] = useState<TPuzzle | undefined>(undefined)
  const [solveResult, setSolveResult] = useState<SolveResult<TSolution> | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [extractStartedAt, setExtractStartedAt] = useState<number | undefined>(undefined)
  // Reported by the editor, which is the only thing that can see its own uncommitted work.
  const [editorBlocker, setEditorBlocker] = useState<string | undefined>(undefined)
  const elapsedMs = useElapsedMs(extractStartedAt)
  const blockerId = useId()

  const onImage = useCallback(
    async (image: Blob) => {
      setStatus('extracting')
      setExtractStartedAt(Date.now())
      setError(undefined)
      setSolveResult(undefined)
      // Otherwise a failed read keeps the previous puzzle's review state alive behind the error.
      setPuzzle(undefined)

      try {
        const downscaled = await downscaleToJpeg(image, definition.maxImageEdge)
        const response = await definition.extract(downscaled)
        if (response.ok) {
          setPuzzle(response.puzzle)
          setStatus('reviewing')
        } else {
          setError(response.error.message)
          setStatus('idle')
        }
      } catch {
        setError('Could not read that image. Try another picture')
        setStatus('idle')
      } finally {
        setExtractStartedAt(undefined)
      }
    },
    [definition],
  )

  const onEdit = useCallback((next: TPuzzle) => {
    setPuzzle(next)
    // Any edit invalidates the previous solve.
    setSolveResult(undefined)
  }, [])

  const onSolve = useCallback(() => {
    if (puzzle !== undefined) {
      setSolveResult(definition.solve(puzzle, { timeoutMs: SOLVE_TIMEOUT_MS }))
    }
  }, [definition, puzzle])

  const onManualEntry = useCallback(() => {
    setPuzzle(definition.blank())
    setSolveResult(undefined)
    setError(undefined)
    setStatus('reviewing')
  }, [definition])

  const onReset = useCallback(() => {
    setPuzzle(undefined)
    setSolveResult(undefined)
    setError(undefined)
    setStatus('idle')
  }, [])

  const isSolved = solveResult?.status === 'solved' || solveResult?.status === 'multiple'
  // The editor's reason wins: an unfinished edit is the more immediate thing to deal with, and
  // whatever the puzzle itself is missing may well be what that edit is about to supply.
  const solveBlocker =
    editorBlocker ?? (puzzle === undefined ? undefined : definition.solveBlocker(puzzle))

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
          {error ? <ErrorPanel message={error} /> : undefined}
        </div>
      ) : undefined}

      {status === 'reviewing' && puzzle !== undefined ? (
        <div className="flex flex-col gap-4">
          <ReviewBanner
            unreviewedCount={definition.unreviewedCount(puzzle)}
            isBlocked={solveBlocker !== undefined}
            result={solveResult}
          />

          {solveResult && 'solution' in solveResult ? (
            <Solution puzzle={puzzle} solution={solveResult.solution} />
          ) : (
            <Editor puzzle={puzzle} onChange={onEdit} onBlockerChange={setEditorBlocker} />
          )}

          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {isSolved ? (
                <button
                  type="button"
                  onClick={() => {
                    setSolveResult(undefined)
                  }}
                  className={`${BUTTON} border border-gray-6 text-gray-12 hocus-visible:bg-gray-4`}
                >
                  Back to editing
                </button>
              ) : (
                <button
                  type="button"
                  // `aria-disabled`, not `disabled`: a disabled button takes no pointer or keyboard
                  // events, so the tooltip saying why it is off would be the one thing unreachable.
                  aria-disabled={solveBlocker !== undefined}
                  aria-describedby={solveBlocker ? blockerId : undefined}
                  title={solveBlocker}
                  onClick={() => {
                    if (solveBlocker === undefined) {
                      onSolve()
                    }
                  }}
                  className={`${BUTTON} ${
                    solveBlocker
                      ? 'cursor-not-allowed bg-gray-6 text-gray-11'
                      : 'bg-gray-12 text-gray-1 hocus-visible:bg-gray-12-hover'
                  }`}
                >
                  Solve
                </button>
              )}
              <button
                type="button"
                onClick={onReset}
                className={`${BUTTON} border border-gray-6 text-gray-12 hocus-visible:bg-gray-4`}
              >
                Start over
              </button>
            </div>

            {/* `title` alone would be a desktop-only explanation: a phone has no hover, and this
                app is mostly used on one. Also the button's accessible description. */}
            {solveBlocker && !isSolved ? (
              <p
                id={blockerId}
                role="status"
                className="unstyled my-0! text-center text-sm text-gray-11"
              >
                {solveBlocker}
              </p>
            ) : undefined}
          </div>
        </div>
      ) : undefined}
    </div>
  )
}
