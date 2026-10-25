import type { Size } from './image-header'

/**
 * Shared with the Worker, so nothing here may touch `document`.
 */

const RESAMPLE_MAX_EDGE = 2048

export function scaledSize(
  width: number,
  height: number,
  scale: number,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Never upscales. The cap costs no detail even at Ken Ken's `SEND_EDGE`, the largest crop.
 */
export function resampledSize(width: number, height: number): { width: number; height: number } {
  const longEdge = Math.max(width, height)
  return scaledSize(width, height, longEdge > RESAMPLE_MAX_EDGE ? RESAMPLE_MAX_EDGE / longEdge : 1)
}

/**
 * Decodes near the working size rather than the full frame, 200 MB for 48 MP. Header dimensions
 * precede EXIF orientation, so a width is requested only when both edges exceed the cap. Browsers
 * without resize options ignore them.
 */
export function bitmapOptions(size: Size | undefined): ImageBitmapOptions {
  return size && Math.min(size.width, size.height) > RESAMPLE_MAX_EDGE
    ? { imageOrientation: 'from-image', resizeWidth: RESAMPLE_MAX_EDGE, resizeQuality: 'high' }
    : { imageOrientation: 'from-image' }
}

/**
 * The default resampler drops thin grid lines when shrinking a large photo several times over.
 */
export function drawResampled(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
): void {
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
}
