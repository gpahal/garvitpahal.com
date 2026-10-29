import { useEffect, useId, useRef, useState } from 'react'
import type { ComponentProps, ReactNode, RefObject } from 'react'

import type { Failure } from '@/lib/failure'
import type { PixelImage } from '@/lib/x/puzzle-solvers/capture/pixels'
import type { Capture } from '@/lib/x/puzzle-solvers/capture/rectify'
import type { ProcessingJobs } from '@/lib/x/puzzle-solvers/processing/jobs'
import { failureOf } from '@/lib/x/puzzle-solvers/user-facing-error'
import { NoticeAlert } from '@/components/shared/notice-alert'
import { remedyActions } from '@/components/shared/remedy-actions'
import { ScrollDialog } from '@/components/shared/scroll-dialog'
import { Button } from '@/components/ui/button'

import { CaptureDialogFooter, CaptureDialogMedia } from './capture-dialog'
import { CaptureReview } from './capture-review'
import { useCamera } from './use-camera'

type CameraModalProps = {
  jobs: ProcessingJobs
  isOpen: boolean
  onClose: () => void
  onCapture: (capture: Capture) => void
  finalFocus?: ComponentProps<typeof ScrollDialog>['finalFocus']
}

export function CameraModal({
  jobs,
  isOpen,
  onClose,
  onCapture,
  finalFocus,
}: CameraModalProps): ReactNode {
  // Owned here, since `initialFocus` sits on the popup.
  const shutterRef = useRef<HTMLButtonElement | null>(null)

  return (
    <ScrollDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Take a picture"
      initialFocus={shutterRef}
      finalFocus={finalFocus}
    >
      <CameraView
        jobs={jobs}
        shutterRef={shutterRef}
        onCapture={(capture) => {
          onCapture(capture)
          onClose()
        }}
      />
    </ScrollDialog>
  )
}

function CameraView({
  jobs,
  shutterRef,
  onCapture,
}: {
  jobs: ProcessingJobs
  shutterRef: RefObject<HTMLButtonElement | null>
  onCapture: (capture: Capture) => void
}): ReactNode {
  const [review, setReview] = useState<PixelImage>()
  // Held here so Retake returns to the camera the still was taken with.
  const [deviceId, setDeviceId] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  return review ? (
    <CaptureReview
      image={review}
      jobs={jobs}
      onConfirm={onCapture}
      secondaryLabel="Retake"
      onSecondary={() => {
        setReview(undefined)
      }}
    />
  ) : (
    <Viewfinder
      key={`${attempt}:${deviceId ?? ''}`}
      shutterRef={shutterRef}
      deviceId={deviceId}
      onRetry={() => {
        setAttempt((current) => current + 1)
      }}
      onSwitchCamera={setDeviceId}
      onShot={setReview}
    />
  )
}

type ViewfinderProps = {
  shutterRef: RefObject<HTMLButtonElement | null>
  deviceId: string | undefined
  onSwitchCamera: (deviceId: string) => void
  onRetry: () => void
  onShot: (still: PixelImage) => void
}

function Viewfinder({
  shutterRef,
  deviceId,
  onSwitchCamera,
  onRetry,
  onShot,
}: ViewfinderProps): ReactNode {
  const { videoRef, status, error, nextCamera, capture } = useCamera(deviceId)
  const [captureError, setCaptureError] = useState<Failure>()
  const startingId = useId()
  const errorId = useId()
  const isStarting = status === 'starting'

  // Retake, Try again and Switch camera remount this, unmounting the button that had focus.
  useEffect(() => {
    shutterRef.current?.focus()
  }, [shutterRef])

  function onShutter(): void {
    try {
      onShot(capture())
    } catch (error_) {
      setCaptureError(failureOf(error_, 'That picture could not be taken. Try again'))
    }
  }

  return (
    <>
      <CaptureDialogMedia isBusy={isStarting}>
        {/* playsInline is required or iOS Safari takes the video fullscreen. */}
        <video ref={videoRef} autoPlay muted playsInline className="size-full object-cover" />
        {/* A grid filling the frame squarely is read at more pixels per cell. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="aspect-square w-[78%] rounded-lg border-2 border-white/70" />
        </div>

        {isStarting ? (
          <p
            id={startingId}
            className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground"
          >
            Starting camera…
          </p>
        ) : undefined}

        {error !== undefined ? (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <NoticeAlert
              id={errorId}
              message={error}
              action={
                <div className="flex justify-center">
                  <Button variant="outline" onClick={onRetry}>
                    Try again
                  </Button>
                </div>
              }
            />
          </div>
        ) : undefined}
      </CaptureDialogMedia>

      <CaptureDialogFooter>
        {status === 'live' && captureError ? (
          <NoticeAlert message={captureError.message} action={remedyActions(captureError)} />
        ) : undefined}

        <div className="flex items-center gap-2">
          <div className="flex flex-1 justify-start">
            <Button
              variant="outline"
              onClick={() => {
                if (nextCamera !== undefined) onSwitchCamera(nextCamera)
              }}
              disabled={nextCamera === undefined}
              className="disabled:invisible"
            >
              Switch camera
            </Button>
          </div>
          {/* Focusable while the stream warms up, or the dialog opens with focus on nothing. */}
          <Button
            ref={shutterRef}
            size="icon-lg"
            disabled={status !== 'live'}
            focusableWhenDisabled
            aria-busy={isStarting}
            aria-describedby={isStarting ? startingId : error !== undefined ? errorId : undefined}
            aria-label="Take picture"
            onClick={onShutter}
            className="size-14 rounded-full border-4 border-ring"
          />
          <div aria-hidden="true" className="flex-1" />
        </div>
      </CaptureDialogFooter>
    </>
  )
}
