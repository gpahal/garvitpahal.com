import { useEffect, useId, useReducer, useRef } from 'react'
import type { ComponentProps, ComponentType, ReactNode, RefObject } from 'react'

import type { Failure } from '@/lib/failure'
import { retainUnloadWarning } from '@/lib/unload-warning'
import type { PuzzleId, PuzzleOf, RegisteredPuzzle } from '@/lib/x/puzzle-solvers/puzzles/registry'
import type { RetainedPicture } from '@/lib/x/puzzle-solvers/vision/read-picture'
import { initialWorkspaceState, reduceWorkspace } from '@/lib/x/puzzle-solvers/workspace-state'
import type { WorkspaceState } from '@/lib/x/puzzle-solvers/workspace-state'
import { useDiscardConfirmation } from '@/hooks/use-discard-confirmation'
import { ElapsedSeconds } from '@/components/shared/elapsed-seconds'
import { NoticeAlert } from '@/components/shared/notice-alert'
import { Muted } from '@/components/shared/typography'
import { Button } from '@/components/ui/button'

import { CapturePane } from '../capture/capture-pane'
import type { PuzzleEditorProps, PuzzleSolutionProps } from '../puzzles/puzzle-ui'
import { DISCARD_CAGE_AND_UNDO, replaceWording, startOverWording } from './discard-wording'
import { PuzzleActions } from './puzzle-actions'
import { ReadActions } from './read-actions'
import { RetryWait } from './retry-wait'
import { ReviewBanner } from './review-banner'
import { useFocusAfterUnmount } from './use-focus-after-unmount'
import type { FocusTarget } from './use-focus-after-unmount'
import { usePuzzleProcessing } from './use-puzzle-processing'

const READING_BLOCKER = 'Wait for the read to finish, or cancel it'

function stageOf(activity: WorkspaceState<unknown>['activity']): string | undefined {
  if (activity.kind === 'solving') return 'Solving'
  return activity.kind === 'reading' ? activity.stage : undefined
}

function retryAction(
  picture: RetainedPicture | undefined,
  {
    isNew,
    isPending,
    stage,
    onRetry,
  }: {
    isNew: boolean
    isPending: boolean
    stage: string | undefined
    onRetry: (picture: RetainedPicture) => void
  },
): ComponentProps<typeof ReadActions>['retry'] {
  if (picture === undefined || picture.noRetry) return undefined
  return {
    label: isNew ? 'Try the new picture again' : 'Try again',
    isPending,
    pendingLabel: `${stage ?? 'Reading puzzle'}…`,
    onRetry: () => {
      onRetry(picture)
    },
  }
}

/**
 * The status is present before any stage starts, so every stage change is announced, and Solved is
 * said once per solve.
 */
function JobProgress({
  stage,
  isSolved,
  startedAt,
  cancelRef,
  onCancelFocus,
  onCancel,
}: {
  stage: string | undefined
  isSolved: boolean
  startedAt: number | undefined
  cancelRef: RefObject<HTMLButtonElement | null>
  onCancelFocus: (isFocused: boolean) => void
  onCancel: () => void
}): ReactNode {
  return (
    <>
      <p role="status" className="sr-only">
        {stage === undefined ? (isSolved ? 'Solved' : '') : `${stage}…`}
      </p>
      {stage === undefined ? undefined : (
        <div className="flex flex-col items-center gap-2">
          <Muted>
            {stage}…{' '}
            {startedAt === undefined ? undefined : <ElapsedSeconds startedAt={startedAt} />}
          </Muted>
          <Button
            ref={cancelRef}
            variant="outline"
            size="sm"
            onFocus={() => {
              onCancelFocus(true)
            }}
            onBlur={() => {
              onCancelFocus(false)
            }}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      )}
    </>
  )
}

function PuzzleView<TId extends PuzzleId>({
  definition,
  Editor,
  Solution,
  puzzle,
  solution,
  readId,
  editorRef,
  review,
  onChange,
  onBlockerChange,
  actions,
}: {
  definition: RegisteredPuzzle<TId>
  Editor: ComponentType<PuzzleEditorProps<PuzzleOf<TId>>>
  Solution: ComponentType<PuzzleSolutionProps<PuzzleOf<TId>>>
  puzzle: PuzzleOf<TId>
  solution: PuzzleSolutionProps<PuzzleOf<TId>>['solution'] | undefined
  /**
   * Keys the editor, so a new read starts it afresh.
   */
  readId: number
  editorRef: RefObject<HTMLDivElement | null>
  review: Pick<
    ComponentProps<typeof ReviewBanner>,
    'isReviewPending' | 'isReading' | 'result' | 'origin'
  >
  onChange: PuzzleEditorProps<PuzzleOf<TId>>['onChange']
  onBlockerChange: PuzzleEditorProps<PuzzleOf<TId>>['onBlockerChange']
  actions: ComponentProps<typeof PuzzleActions>
}): ReactNode {
  return (
    <>
      <ReviewBanner
        unreviewedCount={definition.unreviewedCount(puzzle)}
        reviewUnit={definition.reviewUnit}
        reviewNote={definition.reviewNote?.(puzzle)}
        {...review}
        timeoutHint={definition.timeoutHint}
      />
      {solution === undefined ? (
        <div ref={editorRef}>
          <Editor
            key={readId}
            puzzle={puzzle}
            onChange={onChange}
            onBlockerChange={onBlockerChange}
          />
        </div>
      ) : (
        <Solution puzzle={puzzle} solution={solution} />
      )}
      <PuzzleActions {...actions} />
    </>
  )
}

function useLiftWait(
  retryAt: number | undefined,
  dispatch: (event: { type: 'waitElapsed' }) => void,
): void {
  useEffect(() => {
    if (retryAt === undefined) return
    const id = setTimeout(
      () => {
        dispatch({ type: 'waitElapsed' })
      },
      Math.max(0, retryAt - Date.now()),
    )
    return () => {
      clearTimeout(id)
    }
  }, [retryAt, dispatch])
}

function remediesOf(
  error: Failure | undefined,
  notice: Failure | undefined,
): { hasSignInLink: boolean; hasReload: boolean } {
  return {
    hasSignInLink: error?.signIn === true || notice?.signIn === true,
    hasReload: error?.reload === true || notice?.reload === true,
  }
}

function choosePictureAction(
  isCapturing: boolean,
  hasPicture: boolean,
  onChoose: () => void,
): ComponentProps<typeof ReadActions>['choosePicture'] {
  if (isCapturing) return undefined
  return { label: hasPicture ? 'Choose another picture' : 'Use a picture', onChoose }
}

function CaptureSection({
  captureRef,
  keepRef,
  jobs,
  isCapturing,
  canKeep,
  isBusy,
  waitId,
  hasWorkToLose,
  onImage,
  focusAfterCapture,
  onConfirm,
  onKeep,
}: {
  captureRef: RefObject<HTMLDivElement | null>
  keepRef: RefObject<HTMLButtonElement | null>
  jobs: ComponentProps<typeof CapturePane>['jobs']
  isCapturing: boolean
  canKeep: boolean
  isBusy: boolean
  waitId: string | undefined
  hasWorkToLose: boolean
  onImage: ComponentProps<typeof CapturePane>['onImage']
  focusAfterCapture: ComponentProps<typeof CapturePane>['focusAfterCapture']
  onConfirm: (proceed: () => void) => void
  onKeep: () => void
}): ReactNode {
  return (
    <>
      {isCapturing ? (
        <div ref={captureRef}>
          <CapturePane
            jobs={jobs}
            onImage={onImage}
            focusAfterCapture={focusAfterCapture}
            confirmation={hasWorkToLose ? onConfirm : undefined}
            disabled={isBusy}
            describedBy={waitId}
          />
        </div>
      ) : undefined}
      {canKeep ? (
        <div className="flex justify-center">
          <Button ref={keepRef} variant="outline" onClick={onKeep}>
            Keep the current puzzle
          </Button>
        </div>
      ) : undefined}
    </>
  )
}

function ReadNotices({
  error,
  notice,
  retryAt,
  waitId,
}: {
  error: Failure | undefined
  notice: Failure | undefined
  retryAt: number | undefined
  waitId: string
}): ReactNode {
  return (
    <>
      {error ? <NoticeAlert message={error.message} /> : undefined}
      {notice ? <NoticeAlert message={notice.message} tone="info" announce="status" /> : undefined}
      {/* Present throughout, so a new wait is announced. */}
      <div role="status" className="empty:hidden">
        {retryAt === undefined ? undefined : <RetryWait id={waitId} retryAt={retryAt} />}
      </div>
    </>
  )
}

export function Workspace<TId extends PuzzleId>({
  definition,
  Editor,
  Solution,
}: {
  definition: RegisteredPuzzle<TId>
  Editor: ComponentType<PuzzleEditorProps<PuzzleOf<TId>>>
  Solution: ComponentType<PuzzleSolutionProps<PuzzleOf<TId>>>
}): ReactNode {
  const [state, dispatch] = useReducer(
    reduceWorkspace<PuzzleOf<TId>>,
    undefined,
    initialWorkspaceState<PuzzleOf<TId>>,
  )
  const {
    history,
    origin,
    isReviewPending,
    readId,
    editorBlocker,
    isChoosing,
    activity,
    error,
    notice,
    retained,
    unread,
    retryAt,
    solveResult,
  } = state
  const { puzzle, previous, isDirty } = history
  const processing = usePuzzleProcessing(definition, dispatch)
  const { jobs, commands } = processing
  const stage = stageOf(activity)
  const startedAt = activity.kind === 'reading' ? activity.startedAt : undefined
  const waitId = useId()
  const confirmation = useDiscardConfirmation()
  const hasWorkToLose = isDirty || editorBlocker !== undefined
  // A read on screen cost an admission even untouched, and leaving or Start over would lose it.
  const isReadOnScreen = puzzle !== undefined && origin === 'read'
  const isReading = activity.kind === 'reading' && activity.stage !== undefined
  // Leaving mid-read loses its admissions too.
  const isUnsaved = hasWorkToLose || isReadOnScreen || isReading
  useEffect(() => (isUnsaved ? retainUnloadWarning() : undefined), [isUnsaved])

  useLiftWait(retryAt, dispatch)

  const editorRef = useRef<HTMLDivElement>(null)
  const retryRef = useRef<HTMLButtonElement>(null)
  const captureRef = useRef<HTMLDivElement>(null)
  const solveRef = useRef<HTMLButtonElement>(null)
  const keepRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const findCaptureInput = (): HTMLInputElement | null | undefined =>
    captureRef.current?.querySelector('input')
  const findGridCell = (): HTMLElement | null | undefined =>
    editorRef.current?.querySelector<HTMLElement>(':scope [role="grid"] [tabindex="0"]')
  const focus = useFocusAfterUnmount(stage !== undefined, {
    retry: () => retryRef.current,
    capture: findCaptureInput,
    grid: findGridCell,
    solve: () => solveRef.current,
    keep: () => keepRef.current,
    cancel: () => cancelRef.current,
  })

  function readPicture(picture: RetainedPicture, isRetry = false): void {
    // Focus goes to the new puzzle rather than Try again, one key press from a paid read.
    processing
      .read(picture, { isRetry, isPuzzleOnScreen: puzzle !== undefined }, () => {
        focus.next(['grid', 'solve'])
      })
      .catch(globalThis.reportError)
  }

  function guarded(action: 'read' | 'picture', proceed: () => void): void {
    confirmation.ask(
      hasWorkToLose,
      replaceWording(action, {
        hasDraft: editorBlocker !== undefined,
        isEntered: origin === 'manual',
      }),
      proceed,
    )
  }
  function onSolve(): void {
    if (puzzle === undefined) return
    processing.solve(puzzle).catch(globalThis.reportError)
  }
  function onUndo(): void {
    confirmation.ask(editorBlocker !== undefined, DISCARD_CAGE_AND_UNDO, () => {
      if (previous !== undefined) commands.undo()
    })
  }
  function onStartOver(): void {
    confirmation.ask(
      hasWorkToLose || isReadOnScreen,
      startOverWording({ isEntered: origin === 'manual', hasWorkToLose }),
      reset,
      findCaptureInput,
    )
  }
  function reset(): void {
    // Moves focus only after a press that asked nothing; the dialog's `focusAfter` covers the rest.
    focus.next(['capture'])
    commands.startOver()
  }
  const puzzleBlocker = puzzle === undefined ? undefined : definition.solveBlocker(puzzle)
  const isSolving = activity.kind === 'solving'
  const isRetryPending = activity.kind === 'reading' && activity.isRetry && isReading
  // Also where focus goes when the job ends by itself with nothing new on screen.
  const afterCancel: Array<FocusTarget> = isSolving
    ? ['solve']
    : ['retry', 'capture', 'grid', 'solve']
  // Solving mid-read would silently cancel the read, whose puzzle may yet replace this one.
  const solveBlocker = editorBlocker ?? (isReading ? READING_BLOCKER : puzzleBlocker)
  const solved = solveResult && 'solution' in solveResult ? solveResult : undefined
  const isWaiting = retryAt !== undefined
  const describedWaitId = isWaiting ? waitId : undefined
  const isCapturing = puzzle === undefined || isChoosing
  const retryPicture = unread ?? retained
  return (
    <div className="flex flex-col gap-5">
      <CaptureSection
        captureRef={captureRef}
        keepRef={keepRef}
        jobs={jobs}
        isCapturing={isCapturing}
        canKeep={isChoosing && puzzle !== undefined}
        isBusy={stage !== undefined || isWaiting}
        waitId={describedWaitId}
        hasWorkToLose={hasWorkToLose}
        onImage={(capture) => {
          // The read disables or removes the upload controls, so its Cancel takes focus.
          focus.next(['cancel'])
          readPicture({ capture })
        }}
        focusAfterCapture={() => cancelRef.current}
        onConfirm={(proceed) => {
          guarded('picture', proceed)
        }}
        onKeep={() => {
          focus.next(['grid', 'solve'])
          dispatch({ type: 'keepCurrent' })
        }}
      />
      <JobProgress
        stage={stage}
        isSolved={solved !== undefined}
        startedAt={startedAt}
        cancelRef={cancelRef}
        onCancelFocus={(isFocused) => {
          focus.whileCancelFocused(isFocused ? afterCancel : undefined)
        }}
        onCancel={() => {
          focus.next(afterCancel)
          commands.cancel()
        }}
      />
      <ReadNotices error={error} notice={notice} retryAt={retryAt} waitId={waitId} />
      {puzzle === undefined ? (
        <Muted className="text-center">
          or{' '}
          <Button
            variant="link"
            onClick={() => {
              focus.next(['grid', 'solve'])
              commands.enterManually(definition.blank())
            }}
          >
            enter it manually
          </Button>
        </Muted>
      ) : (
        <PuzzleView
          definition={definition}
          Editor={Editor}
          Solution={Solution}
          puzzle={puzzle}
          solution={solved?.solution}
          readId={readId}
          editorRef={editorRef}
          review={{ isReviewPending, isReading, result: solveResult, origin }}
          onChange={commands.edit}
          onBlockerChange={commands.changeBlocker}
          actions={{
            solveRef,
            isSolved: solved !== undefined,
            isSolving,
            solveBlocker,
            onSolve,
            onBackToEditing: () => {
              dispatch({ type: 'backToEditing' })
            },
            canUndo: previous !== undefined,
            onUndo,
            onStartOver,
          }}
        />
      )}
      <ReadActions
        reference={retained?.capture}
        retry={retryAction(retryPicture, {
          isNew: unread !== undefined,
          isPending: isRetryPending,
          stage,
          onRetry: (picture) => {
            guarded('read', () => {
              readPicture(picture, true)
            })
          },
        })}
        retryRef={retryRef}
        isBusy={stage !== undefined}
        waitId={describedWaitId}
        {...remediesOf(error, notice)}
        // The puzzle stays until a read of the new picture succeeds.
        choosePicture={choosePictureAction(isCapturing, retryPicture !== undefined, () => {
          focus.next(['capture', 'keep'])
          commands.choosePicture()
        })}
      />
      {confirmation.dialog}
    </div>
  )
}
