import { useCallback, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'

import { CameraModal } from './camera-modal'
import { ImageReviewDialog } from './image-review-dialog'
import { isCameraSupported } from './use-camera'

type CapturePaneProps = {
  onImage: (image: Blob) => void
  disabled?: boolean
}

function unsubscribe(): void {
  // no-op
}

/** Camera support never changes at runtime, so there is nothing to subscribe to. */
function subscribeToNothing(): () => void {
  return unsubscribe
}

/** Server snapshot: `navigator` does not exist there, so the camera button is not rendered. */
function isCameraSupportedOnServer(): boolean {
  return false
}

export function CapturePane({ onImage, disabled = false }: CapturePaneProps): ReactNode {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [pendingUpload, setPendingUpload] = useState<Blob | undefined>(undefined)
  // `navigator` does not exist during server rendering. useSyncExternalStore is the idiomatic way
  // to read browser-only state: the server snapshot is `false`, so there is no hydration mismatch
  // and no effect-driven re-render.
  const hasCamera = useSyncExternalStore(
    subscribeToNothing,
    isCameraSupported,
    isCameraSupportedOnServer,
  )

  // Uploads go through the same review step as the camera, so a picture that needs flipping can be
  // fixed before it is sent rather than after the model has misread it.
  const onFiles = useCallback((files: FileList | null) => {
    const file = files?.[0]
    if (file?.type.startsWith('image/')) {
      setPendingUpload(file)
    }
  }, [])

  return (
    <div className="relative">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => {
          setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          onFiles(event.dataTransfer.files)
        }}
        className={`unstyled flex min-h-44 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-6 py-10 text-center ${
          dragging ? 'border-anchor bg-gray-3' : 'border-gray-6 hocus:bg-gray-2'
        } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <span className="text-sm font-medium text-gray-12">Upload a picture of the puzzle</span>
        <span className="text-sm text-gray-11">Click to choose a file, or drag one here</span>
      </label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          onFiles(event.target.files)
          // Allow picking the same file twice in a row.
          event.target.value = ''
        }}
      />

      {hasCamera ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setCameraOpen(true)
          }}
          aria-label="Take a picture with the camera"
          className="unstyled absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded-lg border border-gray-6 bg-bg text-gray-12 focus-visible:ring-2 focus-visible:ring-anchor focus-visible:outline-none disabled:opacity-50 hocus:bg-gray-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-6 stroke-[1.5]"
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </button>
      ) : undefined}

      {hasCamera ? (
        <CameraModal isOpen={cameraOpen} onOpenChange={setCameraOpen} onCapture={onImage} />
      ) : undefined}

      <ImageReviewDialog
        image={pendingUpload}
        onCancel={() => {
          setPendingUpload(undefined)
        }}
        onConfirm={(image) => {
          setPendingUpload(undefined)
          onImage(image)
        }}
      />
    </div>
  )
}
