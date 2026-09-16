import { useEffect, useRef, useState, type ReactNode } from 'react'

import { blobToPixels } from '@/lib/capture/encode'
import type { PixelImage } from '@/lib/capture/pixels'
import type { Capture } from '@/lib/capture/rectify'
import { Dialog, DialogBody, DialogContent } from '@/components/x/ui/dialog'
import { ErrorPanel } from '@/components/x/ui/error-panel'

import { CaptureReview } from './capture-review'

type ImageReviewDialogProps = {
  /**
  Open whenever there is an image to review.
  */
  image: Blob | undefined
  onCancel: () => void
  onConfirm: (capture: Capture) => void
}

/**
The upload counterpart to the camera's review step.
*/
export function ImageReviewDialog({
  image,
  onCancel,
  onConfirm,
}: ImageReviewDialogProps): ReactNode {
  // Owned here rather than in the view: `initialFocus` sits on the popup, one level up.
  const confirmRef = useRef<HTMLButtonElement | null>(null)

  return (
    <Dialog
      open={image !== undefined}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel()
        }
      }}
    >
      <DialogContent title="Use this picture?" initialFocus={confirmRef}>
        {/* Only mounted while open, so the flip and the quad reset per upload. */}
        {image ? (
          <UploadReview
            image={image}
            confirmRef={confirmRef}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        ) : undefined}
      </DialogContent>
    </Dialog>
  )
}

function UploadReview({
  image,
  confirmRef,
  onCancel,
  onConfirm,
}: {
  image: Blob
  confirmRef: React.RefObject<HTMLButtonElement | null>
  onCancel: () => void
  onConfirm: (capture: Capture) => void
}): ReactNode {
  const [pixels, setPixels] = useState<PixelImage | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let isCancelled = false
    const load = async (): Promise<void> => {
      try {
        const decoded = await blobToPixels(image)
        if (!isCancelled) {
          setPixels(decoded)
        }
      } catch {
        if (!isCancelled) {
          setError('Could not read that file. Try a different picture')
        }
      }
    }
    void load()
    return () => {
      isCancelled = true
    }
  }, [image])

  if (error) {
    return (
      <DialogBody className="p-5">
        <ErrorPanel message={error} />
      </DialogBody>
    )
  }
  if (!pixels) {
    return (
      <DialogBody className="bg-gray-2">
        <div className="flex aspect-3/4 w-full items-center justify-center sm:aspect-video">
          <p role="status" className="unstyled my-0! text-sm text-gray-11">
            Loading picture...
          </p>
        </div>
      </DialogBody>
    )
  }
  return (
    <CaptureReview
      image={pixels}
      confirmRef={confirmRef}
      onConfirm={onConfirm}
      secondaryLabel="Cancel"
      onSecondary={onCancel}
    />
  )
}
