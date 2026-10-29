import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'

import type { Failure } from '@/lib/failure'
import type { PixelImage } from '@/lib/x/puzzle-solvers/capture/pixels'
import type { Capture } from '@/lib/x/puzzle-solvers/capture/rectify'
import type { ProcessingJobs } from '@/lib/x/puzzle-solvers/processing/jobs'
import { OPERATIONS } from '@/lib/x/puzzle-solvers/processing/protocol'
import { failureOf } from '@/lib/x/puzzle-solvers/user-facing-error'
import { useStandIn } from '@/hooks/use-stand-in'
import { NoticeAlert } from '@/components/shared/notice-alert'
import { ReloadButton } from '@/components/shared/reload-button'
import { ScrollDialog, ScrollDialogBody } from '@/components/shared/scroll-dialog'
import { Muted } from '@/components/shared/typography'
import { Button } from '@/components/ui/button'

import { CaptureDialogFooter, CaptureDialogMedia } from './capture-dialog'
import { CaptureReview } from './capture-review'
import { useJob } from './use-job'

type ImageReviewDialogProps = {
  jobs: ProcessingJobs
  image: Blob | undefined
  onCancel: () => void
  onChooseAnother: () => void
  onConfirm: (capture: Capture) => void
  finalFocus?: ComponentProps<typeof ScrollDialog>['finalFocus']
}

export function ImageReviewDialog({
  image,
  jobs,
  onCancel,
  onChooseAnother,
  onConfirm,
  finalFocus,
}: ImageReviewDialogProps): ReactNode {
  // Stays on screen while the dialog animates out; a new key once it has closed lets the picture
  // go, which aborts its decode and frees the decoded pixels.
  const [standInKey, setStandInKey] = useState(0)
  const shown = useStandIn(image, standInKey)
  const decoded = useJob(
    jobs,
    'decode',
    useMemo(() => (shown ? { source: shown } : undefined), [shown]),
  )
  const failure =
    decoded?.ok === false ? failureOf(decoded.error, OPERATIONS.decode.failure) : undefined

  return (
    <ScrollDialog
      isOpen={image !== undefined}
      onClose={onCancel}
      onClosed={() => {
        setStandInKey((key) => key + 1)
      }}
      title={failure ? 'Picture could not be opened' : 'Use this picture?'}
      finalFocus={finalFocus}
    >
      {/* Unmounted once closed, so the flip and the quad reset per upload. */}
      {shown ? (
        <UploadReview
          pixels={decoded?.ok ? decoded.output : undefined}
          failure={failure}
          jobs={jobs}
          onCancel={onCancel}
          onChooseAnother={onChooseAnother}
          onConfirm={onConfirm}
        />
      ) : undefined}
    </ScrollDialog>
  )
}

function UploadReview({
  pixels,
  failure,
  jobs,
  onCancel,
  onChooseAnother,
  onConfirm,
}: {
  pixels: PixelImage | undefined
  failure: Failure | undefined
  jobs: ProcessingJobs
  onCancel: () => void
  onChooseAnother: () => void
  onConfirm: (capture: Capture) => void
}): ReactNode {
  if (failure) {
    return (
      <OpenFailureView failure={failure} onCancel={onCancel} onChooseAnother={onChooseAnother} />
    )
  }
  return !pixels ? (
    <CaptureDialogMedia className="flex items-center justify-center" isBusy>
      <Muted role="status">Loading picture…</Muted>
    </CaptureDialogMedia>
  ) : (
    <CaptureReview
      image={pixels}
      jobs={jobs}
      onConfirm={onConfirm}
      secondaryLabel="Cancel"
      onSecondary={onCancel}
    />
  )
}

function OpenFailureView({
  failure,
  onCancel,
  onChooseAnother,
}: {
  failure: Failure
  onCancel: () => void
  onChooseAnother: () => void
}): ReactNode {
  // Another picture cannot help a `noRetry` failure, so Cancel is then the only way on.
  const wayOnRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    wayOnRef.current?.focus()
  }, [])
  const wayOn = failure.reload ? (
    <ReloadButton ref={wayOnRef} />
  ) : failure.noRetry ? undefined : (
    <Button ref={wayOnRef} onClick={onChooseAnother}>
      Choose another picture
    </Button>
  )
  return (
    <>
      <ScrollDialogBody>
        <NoticeAlert message={failure.message} />
      </ScrollDialogBody>
      <CaptureDialogFooter>
        <div className="flex items-center justify-end gap-2">
          <Button ref={wayOn ? undefined : wayOnRef} variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {wayOn}
        </div>
      </CaptureDialogFooter>
    </>
  )
}
