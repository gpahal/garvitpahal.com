import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

import type { PixelImage } from '@/lib/capture/pixels'
import type { Capture } from '@/lib/capture/rectify'
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/x/ui/dialog'
import { ErrorPanel } from '@/components/x/ui/error-panel'

import { CaptureReview } from './capture-review'
import { CAPTURE_BUTTON } from './controls'
import { useCamera } from './use-camera'

type CameraModalProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onCapture: (capture: Capture) => void
}

export function CameraModal({ isOpen, onOpenChange, onCapture }: CameraModalProps): ReactNode {
  // Owned here rather than in the view: `initialFocus` sits on the popup, one level up.
  const shutterRef = useRef<HTMLButtonElement | null>(null)

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent title="Take a picture" initialFocus={shutterRef}>
        {/*
          CameraView is only mounted while the dialog is open, so its unmount cleanup is what stops
          the media tracks. Holding the camera hook out here would leave the device light on.
        */}
        <CameraView
          shutterRef={shutterRef}
          onCapture={(capture) => {
            onCapture(capture)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

/**
 * Two states: a live viewfinder, then a frozen review. Nothing leaves this component until the user
 * explicitly confirms the still they took.
 */
function CameraView({
  shutterRef,
  onCapture,
}: {
  shutterRef: RefObject<HTMLButtonElement | null>
  onCapture: (capture: Capture) => void
}): ReactNode {
  const { videoRef, status, error, canSwitchCamera, switchCamera, capture } = useCamera()
  const [review, setReview] = useState<PixelImage | undefined>(undefined)
  const [captureError, setCaptureError] = useState<string | undefined>(undefined)
  const confirmRef = useRef<HTMLButtonElement | null>(null)

  const isLive = status === 'live'

  // Taking a shot swaps the whole footer, so the button that was focused unmounts and focus would
  // fall to the body. Hand it to whichever primary action replaced it.
  useEffect(() => {
    const target = review ? confirmRef.current : shutterRef.current
    target?.focus()
  }, [review, shutterRef])

  const onShutter = useCallback(() => {
    try {
      setReview(capture())
      setCaptureError(undefined)
    } catch {
      setCaptureError('Could not take that picture. Try again')
    }
  }, [capture])

  if (review) {
    return (
      <CaptureReview
        image={review}
        confirmRef={confirmRef}
        onConfirm={onCapture}
        secondaryLabel="Retake"
        onSecondary={() => {
          setReview(undefined)
        }}
      />
    )
  }

  return (
    <>
      <DialogBody className="bg-gray-2">
        <div className="relative aspect-3/4 w-full sm:aspect-video">
          {/* playsInline is required or iOS Safari takes the video fullscreen. */}
          <video ref={videoRef} autoPlay muted playsInline className="size-full object-cover" />
          {/*
            Framing guide. The grid is found and cropped afterwards, but one that fills the frame
            squarely is read at more pixels per cell than one that does not.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="aspect-square w-[78%] rounded-lg border-2 border-white/70" />
          </div>

          {status === 'starting' ? (
            <p className="unstyled absolute inset-0 my-0! flex items-center justify-center text-sm text-gray-11">
              Starting camera...
            </p>
          ) : undefined}

          {error ? (
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <ErrorPanel message={error.message} className="bg-bg" />
            </div>
          ) : undefined}
        </div>
      </DialogBody>

      <DialogFooter>
        {captureError ? <ErrorPanel message={captureError} className="mb-3" /> : undefined}

        <div className="flex items-center gap-2">
          <div className="flex flex-1 justify-start">
            <button
              type="button"
              onClick={switchCamera}
              disabled={!canSwitchCamera}
              className={`${CAPTURE_BUTTON} border border-gray-6 text-gray-12 disabled:invisible hocus-visible:bg-gray-4`}
            >
              Switch camera
            </button>
          </div>
          {/*
            `aria-disabled` rather than `disabled` while the stream warms up: a disabled button
            cannot take focus, so the dialog would open with focus on nothing useful. This stays
            focusable and announces as unavailable.
          */}
          <button
            ref={shutterRef}
            type="button"
            onClick={() => {
              if (isLive) {
                onShutter()
              }
            }}
            aria-disabled={!isLive}
            aria-label="Take picture"
            className={`unstyled size-14 shrink-0 rounded-full border-4 border-gray-8 bg-gray-12 focus-visible:ring-2 focus-visible:ring-anchor focus-visible:outline-none ${
              isLive ? 'hocus-visible:bg-gray-12-hover' : 'opacity-40'
            }`}
          />
          <div aria-hidden="true" className="flex-1" />
        </div>
      </DialogFooter>
    </>
  )
}
