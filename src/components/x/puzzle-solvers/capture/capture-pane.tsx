import { useId, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

import { cn } from 'cn'
import { Camera } from 'lucide-react'

import { idRefs } from '@/lib/form-fields'
import type { Capture } from '@/lib/x/puzzle-solvers/capture/rectify'
import type { ProcessingJobs } from '@/lib/x/puzzle-solvers/processing/jobs'
import {
  canReadPictures,
  OUTDATED_BROWSER_MESSAGE,
} from '@/lib/x/puzzle-solvers/vision/read-picture'
import { NoticeAlert } from '@/components/shared/notice-alert'
import { MutedText } from '@/components/shared/typography'
import { Button } from '@/components/ui/button'

import { CameraModal } from './camera-modal'
import { ImageReviewDialog } from './image-review-dialog'
import { isCameraSupported } from './use-camera'

type CapturePaneProps = {
  jobs: ProcessingJobs
  onImage: (capture: Capture) => void
  /**
   * Asked before the picker or camera opens, so declining loses no picture.
   */
  confirmation?: (proceed: () => void) => void
  disabled?: boolean
  /**
   * Says why the pane is disabled. While set, the disabled controls stay focusable.
   */
  describedBy?: string
  /**
   * The read a picture starts disables or removes this pane, so the dialog cannot return focus here.
   */
  focusAfterCapture?: () => HTMLElement | null
}

const unsubscribe = (): void => undefined

function subscribeToNothing(): () => void {
  return unsubscribe
}

export function CapturePane({
  onImage,
  jobs,
  confirmation,
  disabled = false,
  describedBy,
  focusAfterCapture,
}: CapturePaneProps): ReactNode {
  const [dragging, setDragging] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [pendingUpload, setPendingUpload] = useState<Blob>()
  const [uploadError, setUploadError] = useState<string>()
  const ask =
    confirmation ??
    ((proceed: () => void) => {
      proceed()
    })
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Set just before a click the owner already confirmed. Browsers open the picker only inside a
  // press.
  const isConfirmedRef = useRef(false)
  function openPicker(): void {
    isConfirmedRef.current = true
    inputRef.current?.click()
  }
  const inputId = useId()
  const errorId = `${inputId}-error`
  const hasCamera = useSyncExternalStore(subscribeToNothing, isCameraSupported, () => false)
  // `aria-disabled`, since a disabled control takes no focus and its description is never heard.
  const isReachableWhenDisabled = disabled && describedBy !== undefined
  // Only a confirmed close sends focus on; a cancelled one returns it to the opener.
  const isCapturedRef = useRef(false)
  function capture(image: Capture): void {
    isCapturedRef.current = true
    onImage(image)
  }
  // `false` leaves focus alone when the target is not there yet; the owner moves it then.
  function finalFocus(): HTMLElement | boolean {
    if (!isCapturedRef.current) return true
    isCapturedRef.current = false
    return focusAfterCapture?.() ?? false
  }

  // Checked before any question or dialog, since only updating the browser helps.
  function isOutdatedBrowser(): boolean {
    if (canReadPictures()) return false
    setUploadError(OUTDATED_BROWSER_MESSAGE)
    return true
  }

  function onFile(file: File | undefined): void {
    // An empty MIME type still gets signature inspection and a decode attempt.
    if (file && (!file.type || file.type.startsWith('image/'))) {
      setUploadError(undefined)
      setPendingUpload(file)
    } else {
      // `accept` does not bind a drop, which may also carry no file at all, such as dragged text.
      setUploadError('That file is not a picture. Choose a photo or screenshot of the puzzle')
    }
  }

  return (
    <div className="relative flex flex-col gap-3">
      {/* The input takes focus, so the ring goes on the label the user can see. */}
      <label
        // Even while disabled, or the drop opens the picture in place of the page.
        onDragOver={(event) => {
          event.preventDefault()
          if (disabled) {
            event.dataTransfer.dropEffect = 'none'
            return
          }
          setDragging(true)
        }}
        onDragLeave={() => {
          setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (disabled || isOutdatedBrowser()) return
          // The drop's file list is unreadable once the event is over.
          const file = event.dataTransfer.files[0]
          ask(() => {
            onFile(file)
          })
        }}
        className={cn(
          // Crossing a child would fire `dragleave` on the label and flicker the highlight.
          'flex min-h-44 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-6 py-10 text-center *:pointer-events-none has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted',
          dragging && 'border-ring bg-muted',
        )}
      >
        <span className="text-sm font-medium">Upload a picture of the puzzle</span>
        <MutedText>Choose a file, or drag one here</MutedText>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          disabled={disabled && !isReachableWhenDisabled}
          aria-disabled={isReachableWhenDisabled || undefined}
          aria-invalid={uploadError !== undefined}
          aria-describedby={idRefs(uploadError === undefined ? undefined : errorId, describedBy)}
          className="sr-only"
          onClick={(event) => {
            const isConfirmed = isConfirmedRef.current
            isConfirmedRef.current = false
            if (disabled || isOutdatedBrowser()) {
              event.preventDefault()
              return
            }
            if (!confirmation || isConfirmed) return
            event.preventDefault()
            confirmation(openPicker)
          }}
          onChange={(event) => {
            onFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </label>

      {uploadError !== undefined ? <NoticeAlert id={errorId} message={uploadError} /> : undefined}

      {hasCamera ? (
        <>
          <Button
            variant="outline"
            size="icon-lg"
            disabled={disabled}
            focusableWhenDisabled={isReachableWhenDisabled}
            aria-describedby={describedBy}
            onClick={() => {
              setUploadError(undefined)
              if (isOutdatedBrowser()) return
              ask(() => {
                setCameraOpen(true)
              })
            }}
            aria-label="Take a picture with the camera"
            className="absolute top-3 right-3"
          >
            <Camera strokeWidth={1.5} />
          </Button>
          <CameraModal
            jobs={jobs}
            isOpen={cameraOpen}
            onClose={() => {
              setCameraOpen(false)
            }}
            onCapture={capture}
            finalFocus={finalFocus}
          />
        </>
      ) : undefined}

      <ImageReviewDialog
        jobs={jobs}
        image={pendingUpload}
        onCancel={() => {
          setPendingUpload(undefined)
        }}
        onChooseAnother={() => {
          setPendingUpload(undefined)
          // Still inside the press, so the browser allows the picker; already confirmed.
          openPicker()
        }}
        onConfirm={(image) => {
          setPendingUpload(undefined)
          capture(image)
        }}
        finalFocus={finalFocus}
      />
    </div>
  )
}
