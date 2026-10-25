import { UserFacingError } from '../user-facing-error'
import { validateDimensions } from './image-header'
import type { PixelImage } from './pixels'
import { drawResampled, resampledSize } from './resample'

/**
 * Page only: each needs the DOM.
 */

/**
 * Bounded like a decoded file, because the camera's `ideal` width is a request, not a maximum.
 */
export function videoToPixels(video: HTMLVideoElement): PixelImage {
  validateDimensions({ width: video.videoWidth, height: video.videoHeight })
  const { width, height } = resampledSize(video.videoWidth, video.videoHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new UserFacingError('This browser could not capture the picture. Reload the page', {
      reload: true,
    })
  }
  drawResampled(context, video, width, height)
  const { data } = context.getImageData(0, 0, width, height)
  return { width, height, data }
}

export function drawPixels(canvas: HTMLCanvasElement, image: PixelImage, margin = 0): void {
  canvas.width = image.width + 2 * margin
  canvas.height = image.height + 2 * margin
  const context = canvas.getContext('2d')
  if (context) {
    context.putImageData(new ImageData(image.data, image.width, image.height), margin, margin)
  }
}
