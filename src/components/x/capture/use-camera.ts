import { useCallback, useEffect, useRef, useState } from 'react'

import { canvasToJpeg } from '@/lib/capture/downscale'

export type CameraErrorKind = 'denied' | 'not-found' | 'unavailable' | 'unknown'

export type CameraError = {
  kind: CameraErrorKind
  message: string
}

export type CameraStatus = 'starting' | 'live' | 'error'

export type FacingMode = 'environment' | 'user'

export function isCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

function toCameraError(error: unknown): CameraError {
  const name = error instanceof Error ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError': {
      return {
        kind: 'denied',
        message: 'Camera access was blocked. You can still upload a picture instead.',
      }
    }
    case 'NotFoundError':
    case 'OverconstrainedError': {
      return {
        kind: 'not-found',
        message: 'No camera was found. You can still upload a picture instead.',
      }
    }
    case 'NotReadableError': {
      return {
        kind: 'unavailable',
        message: 'The camera is already in use by another app.',
      }
    }
    default: {
      return {
        kind: 'unknown',
        message: 'The camera could not be started. You can still upload a picture instead.',
      }
    }
  }
}

export type UseCameraResult = {
  videoRef: React.RefObject<HTMLVideoElement | null>
  status: CameraStatus
  error: CameraError | undefined
  canSwitchCamera: boolean
  switchCamera: () => void
  capture: () => Promise<Blob>
}

/**
 * Owns the camera stream for the lifetime of the calling component.
 *
 * There is deliberately no `active` flag: the caller mounts this only while the camera is wanted,
 * so unmount cleanup is the single place that stops tracks. Getting that wrong is what leaves the
 * device indicator light on after the modal closes.
 */
export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | undefined>(undefined)
  const [status, setStatus] = useState<CameraStatus>('starting')
  const [error, setError] = useState<CameraError | undefined>(undefined)
  const [facingMode, setFacingMode] = useState<FacingMode>('environment')
  const [canSwitchCamera, setCanSwitchCamera] = useState(false)

  const stop = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
      streamRef.current = undefined
    }
    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // `ideal`, not `exact`: a laptop with only a front camera should still work.
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 } },
          audio: false,
        })

        if (isCancelled) {
          for (const track of stream.getTracks()) {
            track.stop()
          }
          return
        }

        stop()
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          try {
            await video.play()
          } catch {
            // Autoplay rejection is not fatal - the stream is still attached and visible.
          }
        }
        setStatus('live')

        // Device labels are only populated once permission has been granted, so enumerate after.
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (!isCancelled) {
          setCanSwitchCamera(devices.filter((device) => device.kind === 'videoinput').length > 1)
        }
      } catch (error_) {
        if (!isCancelled) {
          setError(toCameraError(error_))
          setStatus('error')
        }
      }
    }

    void start()

    return () => {
      isCancelled = true
      stop()
    }
  }, [facingMode, stop])

  const switchCamera = useCallback(() => {
    setFacingMode((current) => (current === 'environment' ? 'user' : 'environment'))
  }, [])

  const capture = useCallback(async (): Promise<Blob> => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) {
      throw new Error('The camera is not ready yet')
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not get a 2D canvas context')
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    // Deliberately not ImageCapture.takePhoto(): better quality in theory, poor Safari support.
    return canvasToJpeg(canvas)
  }, [])

  return { videoRef, status, error, canSwitchCamera, switchCamera, capture }
}
