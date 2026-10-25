import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import { nextCameraId } from '@/lib/x/puzzle-solvers/capture/camera-cycle'
import { videoToPixels } from '@/lib/x/puzzle-solvers/capture/canvas-pixels'
import type { PixelImage } from '@/lib/x/puzzle-solvers/capture/pixels'

/**
 * One value, so an error can never sit beside a camera that has since gone live.
 */
type CameraState = { status: 'starting' | 'live' } | { status: 'error'; message: string }

export function isCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- undefined outside a secure context, whatever the DOM types say
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

const CAMERA_FAILED_MESSAGE =
  'The camera could not be started. Try again, or upload a picture instead'

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError': {
      return 'Allow camera access for this site in your browser or device settings, or upload a picture instead'
    }
    case 'NotFoundError':
    case 'OverconstrainedError': {
      return 'No camera was found. Connect one, or upload a picture instead'
    }
    case 'NotReadableError': {
      return 'The camera is in use by another app. Close that app and try again, or upload a picture instead'
    }
    default: {
      return CAMERA_FAILED_MESSAGE
    }
  }
}

const CAMERA_ENDED_MESSAGE = 'The camera stopped. Try again, or upload a picture instead'

type UseCameraResult = {
  videoRef: RefObject<HTMLVideoElement | null>
  status: CameraState['status']
  error: string | undefined
  /**
   * `undefined` when there is no other camera.
   */
  nextCamera: string | undefined
  capture: () => PixelImage
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

/**
 * Mount only while the camera is wanted: unmount is the one place that stops tracks, and getting
 * that wrong leaves the device light on. Retry and switch are remounts. `deviceId` is the caller's
 * so it outlives a camera stopped to review a still.
 */
export function useCamera(deviceId: string | undefined): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | undefined>(undefined)
  const [state, setState] = useState<CameraState>({ status: 'starting' })
  const [nextCamera, setNextCamera] = useState<string>()

  // A callback rather than inline in the cleanup, where lint reads `videoRef.current` as stale.
  const stop = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      stopTracks(stream)
      streamRef.current = undefined
    }
    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
  }, [])

  useEffect(() => {
    let isCancelled = false
    const listeners = new AbortController()
    const onEnded = (): void => {
      if (!isCancelled) setState({ status: 'error', message: CAMERA_ENDED_MESSAGE })
    }

    // Runs once live, since the device list is incomplete before permission. The track names the
    // camera actually opened, which an `ideal` request may not match.
    const listCameras = async (stream: MediaStream) => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (isCancelled) return
        const ids = devices
          .filter((device) => device.kind === 'videoinput' && device.deviceId !== '')
          .map((device) => device.deviceId)
        setNextCamera(nextCameraId(ids, stream.getVideoTracks()[0]?.getSettings().deviceId))
      } catch {
        // A browser that refuses to list devices only loses the switch button.
      }
    }

    const start = async () => {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // `ideal`, so a front-only laptop works and an unplugged camera gives way to another.
          video: {
            ...(deviceId === undefined
              ? { facingMode: { ideal: 'environment' } }
              : { deviceId: { ideal: deviceId } }),
            // Above the 2048 px cap (`resample.ts`) so a camera picks its native 4:3 mode, sharper
            // downscaled than a smaller mode upscaled.
            width: { ideal: 2560 },
          },
          audio: false,
        })
      } catch (error_) {
        if (!isCancelled) {
          setState({ status: 'error', message: cameraErrorMessage(error_) })
        }
        return
      }

      if (isCancelled) {
        stopTracks(stream)
        return
      }

      streamRef.current = stream
      // `stop()` fires no `ended`, so this hears only a loss the page did not cause, which would
      // otherwise leave a frozen viewfinder taking stale frames.
      for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', onEnded, { signal: listeners.signal })
      }
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        try {
          await video.play()
        } catch {
          // Cleanup's `stop()` rejects a pending `play()` only after setting `isCancelled`.
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cleanup sets it while `play()` is awaited
          if (!isCancelled) {
            stop()
            setState({ status: 'error', message: CAMERA_FAILED_MESSAGE })
          }
          return
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cleanup sets it while `play()` is awaited
      if (isCancelled) {
        return
      }
      // An end while `play()` was pending must not be overwritten by `live`.
      if (stream.getVideoTracks().some((track) => track.readyState === 'ended')) {
        setState({ status: 'error', message: CAMERA_ENDED_MESSAGE })
        return
      }
      setState({ status: 'live' })
      listCameras(stream).catch(globalThis.reportError)
    }

    start().catch(globalThis.reportError)

    return () => {
      isCancelled = true
      listeners.abort()
      stop()
    }
  }, [deviceId, stop])

  // Not ImageCapture.takePhoto(): better quality in theory, poor Safari support.
  function capture(): PixelImage {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) {
      throw new Error('The camera is not ready yet')
    }
    return videoToPixels(video)
  }

  return {
    videoRef,
    status: state.status,
    error: state.status === 'error' ? state.message : undefined,
    nextCamera,
    capture,
  }
}
