import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

import { flipImage, flipTransform, NO_FLIP, type Flip } from '@/lib/capture/flip'
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/x/ui/dialog'
import { ErrorPanel } from '@/components/x/ui/error-panel'

import { CAPTURE_BUTTON, FlipToggles } from './controls'
import { useCamera } from './use-camera'

type CameraModalProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onCapture: (image: Blob) => void
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
          onCapture={(image) => {
            onCapture(image)
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
  onCapture: (image: Blob) => void
}): ReactNode {
  const { videoRef, status, error, canSwitchCamera, switchCamera, capture } = useCamera()
  const [review, setReview] = useState<{ blob: Blob; url: string } | undefined>(undefined)
  const [captureError, setCaptureError] = useState<string | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  // Kept across a retake: a camera that shows the world upside down keeps doing so.
  const [flip, setFlip] = useState<Flip>(NO_FLIP)
  const confirmRef = useRef<HTMLButtonElement | null>(null)

  const isLive = status === 'live'
  const transform = flipTransform(flip)

  const clearReview = useCallback(() => {
    setReview((current) => {
      if (current) {
        URL.revokeObjectURL(current.url)
      }
      return undefined
    })
  }, [])

  // Object URLs are not reclaimed automatically.
  useEffect(() => clearReview, [clearReview])

  // Taking a shot swaps the whole footer, so the button that was focused unmounts and focus would
  // fall to the body. Hand it to whichever primary action replaced it.
  useEffect(() => {
    const target = review ? confirmRef.current : shutterRef.current
    target?.focus()
  }, [review, shutterRef])

  const onShutter = useCallback(async () => {
    try {
      const blob = await capture()
      clearReview()
      setReview({ blob, url: URL.createObjectURL(blob) })
      setCaptureError(undefined)
    } catch {
      setCaptureError('Could not take that picture. Try again')
    }
  }, [capture, clearReview])

  // Baked in here rather than at the shutter, so it stays adjustable during review.
  const onUsePicture = useCallback(async () => {
    if (!review) {
      return
    }
    setIsSaving(true)
    try {
      onCapture(await flipImage(review.blob, flip))
    } catch {
      setCaptureError('Could not prepare that picture. Try again')
      setIsSaving(false)
    }
  }, [flip, onCapture, review])

  return (
    <>
      <DialogBody className="bg-gray-2">
        <div className="relative aspect-3/4 w-full sm:aspect-video">
          {review ? (
            <img
              src={review.url}
              alt="Preview of what you just captured"
              style={{ transform }}
              className="size-full object-contain"
            />
          ) : (
            <>
              {/* playsInline is required or iOS Safari takes the video fullscreen. */}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ transform }}
                className="size-full object-cover"
              />
              {/*
                Framing guide. With no CV preprocessing, nudging people to fill the frame squarely
                is the cheapest accuracy lever available.
              */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <div className="aspect-square w-[78%] rounded-lg border-2 border-white/70" />
              </div>
            </>
          )}

          {status === 'starting' && !review ? (
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

        <div className="mb-3">
          <FlipToggles flip={flip} onChange={setFlip} />
        </div>

        {review ? (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={clearReview}
              className={`${CAPTURE_BUTTON} border border-gray-6 text-gray-12 hocus-visible:bg-gray-4`}
            >
              Retake
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={() => void onUsePicture()}
              disabled={isSaving}
              className={`${CAPTURE_BUTTON} bg-gray-12 text-gray-1 disabled:opacity-50 hocus-visible:bg-gray-12-hover`}
            >
              Use picture
            </button>
          </div>
        ) : (
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
              cannot take focus, so the dialog would open with focus on a flip toggle instead of on
              the one thing it exists to do. This stays focusable and announces as unavailable.
            */}
            <button
              ref={shutterRef}
              type="button"
              onClick={() => {
                if (isLive) {
                  void onShutter()
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
        )}
      </DialogFooter>
    </>
  )
}
