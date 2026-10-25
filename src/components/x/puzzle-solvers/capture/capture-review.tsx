import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { RotateCcw, RotateCw, TrianglesCenterlineDashedVertical } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  combine,
  FLIP,
  orientImage,
  orientQuad,
  TURN_LEFT,
  TURN_RIGHT,
  UPRIGHT,
} from '@/lib/x/puzzle-solvers/capture/orientation'
import type { Orientation } from '@/lib/x/puzzle-solvers/capture/orientation'
import type { PixelImage } from '@/lib/x/puzzle-solvers/capture/pixels'
import {
  fullFrameQuad,
  isSameQuad,
  isSmallCrop,
  isUsableQuad,
} from '@/lib/x/puzzle-solvers/capture/quad'
import type { Quad } from '@/lib/x/puzzle-solvers/capture/quad'
import { DRAG_CORNERS_MESSAGE } from '@/lib/x/puzzle-solvers/capture/rectify'
import type { Capture } from '@/lib/x/puzzle-solvers/capture/rectify'
import { WorkerStartError } from '@/lib/x/puzzle-solvers/processing/jobs'
import type { ProcessingJobs } from '@/lib/x/puzzle-solvers/processing/jobs'
import { NoticeAlert } from '@/components/shared/notice-alert'
import { ReloadButton } from '@/components/shared/reload-button'
import { Muted } from '@/components/shared/typography'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'

import { CaptureDialogFooter, CaptureDialogMedia } from './capture-dialog'
import { QuadEditor } from './quad-editor'
import { useJob } from './use-job'

type CaptureReviewProps = {
  image: PixelImage
  jobs: ProcessingJobs
  onConfirm: (capture: Capture) => void
  secondaryLabel: string
  onSecondary: () => void
}

/**
 * Icon-only squares below `sm`, so the picture and its handles get a phone's height. The name
 * stays as an `aria-label` and tooltip.
 */
const ICON_ONLY_ON_PHONES = 'max-sm:w-7 max-sm:px-0'

const TURNS = [
  { label: 'Rotate left', Icon: RotateCcw, change: TURN_LEFT },
  { label: 'Rotate right', Icon: RotateCw, change: TURN_RIGHT },
] as const

function iconControl(
  label: string,
  Icon: LucideIcon,
): { className: string; 'aria-label': string; title: string; children: ReactNode } {
  return {
    className: ICON_ONLY_ON_PHONES,
    'aria-label': label,
    title: label,
    children: (
      <>
        <Icon strokeWidth={1.5} />
        <span className="max-sm:hidden">{label}</span>
      </>
    ),
  }
}

/**
 * Unusable corners outrank everything, since nothing can be read from a folded or mirrored shape;
 * a small grid comes next. Failed detection reads as a grid not found, since dragging is the way
 * on either way.
 */
function reviewHint(
  isAwaitingDetection: boolean,
  isUsable: boolean,
  isSmall: boolean,
  detected: Quad | undefined,
): string {
  if (isAwaitingDetection) {
    return 'Finding the grid…'
  }
  if (!isUsable) {
    return DRAG_CORNERS_MESSAGE
  }
  if (isSmall) {
    return 'The grid is small in this picture, so it may not read well. Move closer or use a larger picture'
  }
  return detected
    ? 'Drag the corners onto the corners of the grid if they are off. Only the grid inside them is read'
    : 'The grid could not be found. Drag the corners onto the corners of the grid'
}

/**
 * `image` must not change while mounted: the grid is detected once, on `image`, and a turn or flip
 * moves the corners with the picture.
 */
export function CaptureReview({
  image,
  jobs,
  onConfirm,
  secondaryLabel,
  onSecondary,
}: CaptureReviewProps): ReactNode {
  const [orientation, setOrientation] = useState<Orientation>(UPRIGHT)
  const hintId = useId()
  const oriented = useMemo(() => orientImage(image, orientation), [image, orientation])

  // `undefined` while detecting.
  const detection = useJob(
    jobs,
    'detect',
    useMemo(() => ({ image }), [image]),
  )
  // On the picture as shown.
  const [manual, setManual] = useState<Quad>()
  const isDetecting = detection === undefined
  // Placed corners no longer wait for detection.
  const isAwaitingDetection = isDetecting && manual === undefined
  // A new picture would not fix a Worker that cannot start; any other failure reads as no grid.
  const startError =
    detection?.ok === false && detection.error instanceof WorkerStartError
      ? detection.error.message
      : undefined
  // On `image`, before orientation.
  const detectedQuad = detection?.ok ? detection.output : undefined
  // Focusable while disabled, so focus lands here during detection rather than on nothing.
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    confirmRef.current?.focus()
  }, [])
  const detected = useMemo(
    () => detectedQuad && orientQuad(detectedQuad, orientation, image),
    [detectedQuad, orientation, image],
  )

  const fullFrame = fullFrameQuad(oriented.width, oriented.height)
  const current = manual ?? detected ?? fullFrame
  const isWholePicture = isSameQuad(current, fullFrame)

  // Refused here, while the corners can be fixed, rather than after a paid read.
  const isUsable = isUsableQuad(current, oriented.width, oriented.height)

  // `change` applies to the picture as shown, where the dragged corners are.
  function reorient(change: Orientation): void {
    setOrientation(combine(orientation, change))
    setManual(manual && orientQuad(manual, change, oriented))
  }

  function onUsePicture(): void {
    onConfirm({ image: oriented, quad: current })
  }

  return (
    <>
      <CaptureDialogMedia isBusy={isDetecting}>
        <QuadEditor image={oriented} quad={current} onChange={setManual} />
      </CaptureDialogMedia>

      <CaptureDialogFooter>
        {startError !== undefined ? (
          <NoticeAlert id={hintId} message={startError} action={<ReloadButton />} />
        ) : undefined}
        {/* Present throughout, so each new hint is announced. */}
        <Muted
          id={startError !== undefined ? undefined : hintId}
          className="text-center empty:hidden"
          role="status"
        >
          {startError !== undefined
            ? ''
            : reviewHint(isAwaitingDetection, isUsable, isSmallCrop(current), detected)}
        </Muted>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex gap-1">
            {TURNS.map(({ label, Icon, change }) => (
              <Button
                key={label}
                variant="outline"
                size="sm"
                {...iconControl(label, Icon)}
                onClick={() => {
                  reorient(change)
                }}
              />
            ))}
          </div>
          {/* A toggle, so a mirrored preview is announced. */}
          <Toggle
            {...iconControl('Flip', TrianglesCenterlineDashedVertical)}
            pressed={orientation.mirrored}
            onPressedChange={() => {
              reorient(FLIP)
            }}
          />
          <Toggle
            // Letting go would have nothing to return to with no grid found, or one filling the
            // picture.
            disabled={
              isAwaitingDetection ||
              (isWholePicture && (detected === undefined || isSameQuad(detected, fullFrame)))
            }
            pressed={isWholePicture}
            onPressedChange={(isPressed) => {
              setManual(isPressed ? fullFrame : undefined)
            }}
          >
            Use whole picture
          </Toggle>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
          <Button
            ref={confirmRef}
            disabled={isAwaitingDetection || !isUsable || startError !== undefined}
            focusableWhenDisabled
            aria-describedby={hintId}
            onClick={onUsePicture}
          >
            Use picture
          </Button>
        </div>
      </CaptureDialogFooter>
    </>
  )
}
