import { useCallback, useMemo, useState, type ReactNode, type RefObject } from 'react'

import { flipImage, NO_FLIP, type Flip } from '@/lib/capture/flip'
import type { PixelImage } from '@/lib/capture/pixels'
import { detectQuad, fullFrameQuad, type Quad } from '@/lib/capture/quad'
import type { Capture } from '@/lib/capture/rectify'
import { DialogBody, DialogFooter } from '@/components/x/ui/dialog'

import { CAPTURE_BUTTON, FlipToggles } from './controls'
import { QuadEditor } from './quad-editor'

type CaptureReviewProps = {
  image: PixelImage
  confirmRef: RefObject<HTMLButtonElement | null>
  onConfirm: (capture: Capture) => void
  /**
  The other way out: retake, or cancel.
  */
  secondaryLabel: string
  onSecondary: () => void
}

/**
 * The review step both capture paths share: the frozen picture, the grid the detector found with
 * handles to correct it, and the flips. Nothing leaves until the user confirms, and what leaves
 * is the picture with the corners on it - the puzzle decides what to make of that.
 */
export function CaptureReview({
  image,
  confirmRef,
  onConfirm,
  secondaryLabel,
  onSecondary,
}: CaptureReviewProps): ReactNode {
  const [flip, setFlip] = useState<Flip>(NO_FLIP)

  // The flip is baked into the pixels so the detector, the handles and the preview all agree.
  const flipped = useMemo(() => flipImage(image, flip), [image, flip])
  const detected = useMemo(() => detectQuad(flipped), [flipped])
  // Keyed by the picture it was drawn on: a new picture or a flip gets a fresh detection, and a
  // manual quad is dropped with the pixels it belonged to.
  const [manual, setManual] = useState<{ image: PixelImage; quad: Quad } | undefined>(undefined)
  const quad = manual?.image === flipped ? manual.quad : undefined

  const current = quad ?? detected ?? fullFrameQuad(flipped.width, flipped.height)
  const isWholePicture = quad === undefined && detected === undefined
  const setQuad = useCallback(
    (next: Quad) => {
      setManual({ image: flipped, quad: next })
    },
    [flipped],
  )

  const onUsePicture = useCallback(() => {
    onConfirm({ image: flipped, quad: current })
  }, [current, flipped, onConfirm])

  return (
    <>
      <DialogBody className="bg-gray-2">
        <div className="relative aspect-3/4 w-full sm:aspect-video">
          <QuadEditor image={flipped} quad={current} onChange={setQuad} />
        </div>
      </DialogBody>

      <DialogFooter>
        <p className="unstyled my-0! mb-2 text-center text-xs text-gray-11">
          {detected
            ? 'Drag the corners onto the corners of the grid if they are off'
            : 'No grid found. Drag the corners onto the corners of the grid'}
        </p>

        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          <FlipToggles flip={flip} onChange={setFlip} />
          <button
            type="button"
            aria-pressed={isWholePicture}
            onClick={() => {
              setQuad(fullFrameQuad(flipped.width, flipped.height))
            }}
            className={`${CAPTURE_BUTTON} border border-gray-6 text-gray-12 hocus-visible:bg-gray-4`}
          >
            Use whole picture
          </button>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onSecondary}
            className={`${CAPTURE_BUTTON} border border-gray-6 text-gray-12 hocus-visible:bg-gray-4`}
          >
            {secondaryLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onUsePicture}
            className={`${CAPTURE_BUTTON} bg-gray-12 text-gray-1 hocus-visible:bg-gray-12-hover`}
          >
            Use picture
          </button>
        </div>
      </DialogFooter>
    </>
  )
}
