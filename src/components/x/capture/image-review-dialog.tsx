import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { flipImage, flipTransform, NO_FLIP, type Flip } from '@/lib/capture/flip'
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/x/ui/dialog'

import { CAPTURE_BUTTON, FlipToggles } from './controls'

type ImageReviewDialogProps = {
  /** Open whenever there is an image to review. */
  image: Blob | undefined
  onCancel: () => void
  onConfirm: (image: Blob) => void
}

/** The upload counterpart to the camera's review step. */
export function ImageReviewDialog({
  image,
  onCancel,
  onConfirm,
}: ImageReviewDialogProps): ReactNode {
  return (
    <Dialog
      open={image !== undefined}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel()
        }
      }}
    >
      <DialogContent title="Use this picture?">
        {/* Only mounted while open, so the flip resets and the object URL is revoked per upload. */}
        {image ? (
          <ImageReviewView image={image} onCancel={onCancel} onConfirm={onConfirm} />
        ) : undefined}
      </DialogContent>
    </Dialog>
  )
}

function ImageReviewView({
  image,
  onCancel,
  onConfirm,
}: {
  image: Blob
  onCancel: () => void
  onConfirm: (image: Blob) => void
}): ReactNode {
  const [flip, setFlip] = useState<Flip>(NO_FLIP)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const url = useMemo(() => URL.createObjectURL(image), [image])
  // Object URLs are not reclaimed automatically.
  useEffect(
    () => () => {
      URL.revokeObjectURL(url)
    },
    [url],
  )

  const onUsePicture = useCallback(async () => {
    setIsSaving(true)
    try {
      onConfirm(await flipImage(image, flip))
    } catch {
      setError('Could not prepare that picture. Try again.')
      setIsSaving(false)
    }
  }, [flip, image, onConfirm])

  return (
    <>
      <DialogBody className="bg-gray-2">
        <div className="relative aspect-3/4 w-full sm:aspect-video">
          <img
            src={url}
            alt="Preview of the file you chose"
            style={{ transform: flipTransform(flip) }}
            className="size-full object-contain"
          />
        </div>
      </DialogBody>

      <DialogFooter>
        {error ? (
          <p role="alert" className="unstyled mt-0! mb-2! text-sm text-gray-11">
            {error}
          </p>
        ) : undefined}

        <div className="mb-3">
          <FlipToggles flip={flip} onChange={setFlip} />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={`${CAPTURE_BUTTON} border border-gray-6 text-gray-12 hocus:bg-gray-4`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onUsePicture()}
            disabled={isSaving}
            className={`${CAPTURE_BUTTON} bg-gray-12 text-gray-contrast disabled:opacity-50 hocus:bg-gray-11`}
          >
            Use picture
          </button>
        </div>
      </DialogFooter>
    </>
  )
}
