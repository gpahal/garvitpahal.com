import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'

import type { Capture } from '@/lib/capture/rectify'
import type { VisionModel } from '@/lib/vision/model'
import { CapturePane } from '@/components/x/capture/capture-pane'
import { ErrorPanel } from '@/components/x/ui/error-panel'
import type {
  ExtractReadMeta,
  PuzzleDefinition,
  ReadConfidence,
  SolveResult,
} from '@/puzzles/types'
import type { PuzzleUi } from '@/puzzles/ui-registry'

import { ReviewBanner } from './review-banner'
import { useElapsedMs } from './use-elapsed-ms'

const SOLVE_TIMEOUT_MS = 3000

type Status = 'idle' | 'extracting' | 'reviewing'

const BUTTON =
  'unstyled inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:ring-anchor focus-visible:outline-none focus-visible:ring-2'

type WorkspaceProps<TPuzzle, TSolution, TPrepared> = {
  definition: PuzzleDefinition<TPuzzle, TSolution, TPrepared>
  ui: PuzzleUi<TPuzzle, TSolution>
}

/**
One read as the browser judged it.
*/
type Candidate<TPuzzle> = {
  puzzle: TPuzzle
  rank: number
  confidence: ReadConfidence
  fingerprint: string | undefined
  /**
  `id@effort`: agreement only counts between different configurations, not one model twice.
  */
  modelKey: string
}

/**
 * One extraction, from capture to the read that ends it. Held in a ref rather than state because
 * reads arrive from outside React's render cycle and several may land before a render; the
 * controller doubles as the generation token, so a read from a superseded extraction is ignored.
 */
type Extraction<TPuzzle> = {
  controller: AbortController
  shown: Candidate<TPuzzle> | undefined
  suspects: Array<Candidate<TPuzzle>>
  lastResort: Candidate<TPuzzle> | undefined
  isSettled: boolean
}

function modelKey(model: VisionModel): string {
  return `${model.id}@${model.effort ?? 'default'}`
}

const CONFIDENCE_ORDER: Record<ReadConfidence, number> = { misread: 0, suspect: 1, trusted: 2 }

function isBetterRead<TPuzzle>(candidate: Candidate<TPuzzle>, shown: Candidate<TPuzzle>): boolean {
  const byConfidence = CONFIDENCE_ORDER[candidate.confidence] - CONFIDENCE_ORDER[shown.confidence]
  return byConfidence !== 0 ? byConfidence > 0 : candidate.rank > shown.rank
}

/**
 * Capture, review, solve. Generic over the puzzle: it never inspects one, only hands it back to the
 * definition and to that puzzle's own editor.
 *
 * Reads arrive as a stream and the first usable one goes on screen at once; the extraction stays
 * open, and the clock running, until a read can be trusted - a unique solve, or two models
 * agreeing - or the server has nothing more. Anything the user does to the shown read ends the
 * wait, because a replacement landing on top of their edits would throw the edits away.
 */
export function Workspace<TPuzzle, TSolution, TPrepared>({
  definition,
  ui,
}: WorkspaceProps<TPuzzle, TSolution, TPrepared>): ReactNode {
  const { Editor, Solution } = ui

  const [status, setStatus] = useState<Status>('idle')
  const [puzzle, setPuzzle] = useState<TPuzzle | undefined>(undefined)
  // Remounts the editor per read, so a selection or draft never straddles two reads.
  const [readId, setReadId] = useState(0)
  const [solveResult, setSolveResult] = useState<SolveResult<TSolution> | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [extractStartedAt, setExtractStartedAt] = useState<number | undefined>(undefined)
  // Reported by the editor, which is the only thing that can see its own uncommitted work.
  const [editorBlocker, setEditorBlocker] = useState<string | undefined>(undefined)
  const elapsedMs = useElapsedMs(extractStartedAt)
  const blockerId = useId()
  const extractionRef = useRef<Extraction<TPuzzle> | undefined>(undefined)

  /**
  Ends the wait for a better read. Idempotent, and safe to call when nothing is running.
  */
  const settle = useCallback(() => {
    const extraction = extractionRef.current
    if (extraction && !extraction.isSettled) {
      extraction.isSettled = true
      extraction.controller.abort()
    }
    setExtractStartedAt(undefined)
  }, [])

  // Unmounting mid-read must not leave the server reading for nobody.
  useEffect(() => settle, [settle])

  const show = useCallback((next: TPuzzle) => {
    setPuzzle(next)
    setReadId((id) => id + 1)
    setSolveResult(undefined)
    setEditorBlocker(undefined)
    setStatus('reviewing')
  }, [])

  const onRead = useCallback(
    (extraction: Extraction<TPuzzle>, next: TPuzzle, meta: ExtractReadMeta) => {
      if (extractionRef.current !== extraction || extraction.isSettled) {
        return
      }
      const assessment = definition.assess(next)
      const candidate: Candidate<TPuzzle> = {
        puzzle: next,
        rank: meta.rank,
        confidence: assessment.confidence,
        fingerprint: assessment.fingerprint,
        modelKey: modelKey(meta.model),
      }

      if (candidate.confidence === 'trusted') {
        extraction.shown = candidate
        show(candidate.puzzle)
        settle()
        return
      }

      if (candidate.confidence === 'suspect') {
        // Two different models reading the same thing is as good as a proof: a misread that two
        // of them share is exactly what the fingerprint rules exclude.
        const twin =
          candidate.fingerprint === undefined
            ? undefined
            : extraction.suspects.find(
                (other) =>
                  other.fingerprint === candidate.fingerprint &&
                  other.modelKey !== candidate.modelKey,
              )
        if (twin) {
          const agreed = candidate.rank > twin.rank ? candidate : twin
          extraction.shown = { ...agreed, confidence: 'trusted' }
          show(agreed.puzzle)
          settle()
          return
        }
        extraction.suspects.push(candidate)
        if (!extraction.shown || isBetterRead(candidate, extraction.shown)) {
          extraction.shown = candidate
          show(candidate.puzzle)
        }
        return
      }

      // Proven wrong: kept only in case nothing better ever arrives.
      if (!extraction.lastResort || candidate.rank > extraction.lastResort.rank) {
        extraction.lastResort = candidate
      }
    },
    [definition, settle, show],
  )

  const onImage = useCallback(
    async (capture: Capture) => {
      settle()
      const extraction: Extraction<TPuzzle> = {
        controller: new AbortController(),
        shown: undefined,
        suspects: [],
        lastResort: undefined,
        isSettled: false,
      }
      extractionRef.current = extraction

      setStatus('extracting')
      setExtractStartedAt(Date.now())
      setError(undefined)
      setSolveResult(undefined)
      // Otherwise a failed read keeps the previous puzzle's review state alive behind the error.
      setPuzzle(undefined)

      let failure: string | undefined
      try {
        const prepared = await definition.prepare(capture)
        const outcome = await definition.extract(prepared, {
          signal: extraction.controller.signal,
          onRead: (next, meta) => {
            onRead(extraction, next, meta)
          },
        })
        if (!outcome.ok) {
          failure = outcome.error.message
        }
      } catch {
        failure = 'Could not read that image. Try another picture'
      }

      // Superseded by a newer capture, or ended by the user: whatever it was doing is moot.
      if (extractionRef.current !== extraction || extraction.isSettled) {
        return
      }
      extraction.isSettled = true
      setExtractStartedAt(undefined)

      if (extraction.shown) {
        return
      }
      if (extraction.lastResort) {
        // Better than an error: the editor and the warning copy point at what to fix.
        show(extraction.lastResort.puzzle)
        setSolveResult({ status: 'unsolvable' })
        return
      }
      setError(failure ?? 'Could not read that image. Try another picture')
      setStatus('idle')
    },
    [definition, onRead, settle, show],
  )

  const onEdit = useCallback(
    (next: TPuzzle) => {
      // The user has taken over: a later read must not land on top of their change.
      settle()
      setPuzzle(next)
      // Any edit invalidates the previous solve.
      setSolveResult(undefined)
    },
    [settle],
  )

  const onBlockerChange = useCallback(
    (blocker: string | undefined) => {
      // An open draft is an edit in progress, so it ends the wait the same way a committed one does.
      if (blocker !== undefined) {
        settle()
      }
      setEditorBlocker(blocker)
    },
    [settle],
  )

  const onSolve = useCallback(() => {
    if (puzzle !== undefined) {
      setSolveResult(definition.solve(puzzle, { timeoutMs: SOLVE_TIMEOUT_MS }))
    }
  }, [definition, puzzle])

  const onManualEntry = useCallback(() => {
    settle()
    show(definition.blank())
    setError(undefined)
  }, [definition, settle, show])

  const onReset = useCallback(() => {
    settle()
    setPuzzle(undefined)
    setSolveResult(undefined)
    setError(undefined)
    setStatus('idle')
  }, [settle])

  const isSolved = solveResult?.status === 'solved' || solveResult?.status === 'multiple'
  const isVerifying = status === 'reviewing' && extractStartedAt !== undefined
  // The editor's reason wins: an unfinished edit is the more immediate thing to deal with, and
  // whatever the puzzle itself is missing may well be what that edit is about to supply.
  const solveBlocker =
    editorBlocker ?? (puzzle === undefined ? undefined : definition.solveBlocker(puzzle))

  return (
    <div className="flex flex-col gap-5">
      {status === 'idle' || status === 'extracting' ? (
        <div className="flex flex-col gap-3">
          <CapturePane
            onImage={(capture) => void onImage(capture)}
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
            isVerifying={isVerifying}
            elapsedMs={elapsedMs}
            result={solveResult}
          />

          {solveResult && 'solution' in solveResult ? (
            <Solution puzzle={puzzle} solution={solveResult.solution} />
          ) : (
            <Editor
              key={readId}
              puzzle={puzzle}
              onChange={onEdit}
              onBlockerChange={onBlockerChange}
            />
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
