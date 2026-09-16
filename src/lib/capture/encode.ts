import type { PixelImage } from './pixels'

/**
 * Rectified crops are small, so they can afford a high quality: tokens depend on pixels, not
 * bytes, and JPEG ringing on a thin grid line is the thing to avoid.
 */
export const RECTIFIED_JPEG_QUALITY = 0.92

/**
A whole frame is several times the pixels, and the upload is on a phone's connection.
*/
export const WHOLE_PICTURE_JPEG_QUALITY = 0.85

/**
 * Uploads are decoded no larger than this. A 12-megapixel photo is 48MB of RGBA, and the crop is
 * resampled to 1024px anyway, so nothing is lost above it.
 */
export const DECODE_MAX_EDGE = 2048

/**
Canvas-backed conversions between the browser's image types and the pure `PixelImage`.
*/
function createCanvas(
  width: number,
  height: number,
): {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
} {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not get a 2D canvas context')
  }
  return { canvas, context }
}

export async function blobToPixels(source: Blob, maxEdge = DECODE_MAX_EDGE): Promise<PixelImage> {
  const bitmap = await createImageBitmap(source)
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height)
    const scale = longEdge > maxEdge ? maxEdge / longEdge : 1
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const { context } = createCanvas(width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    const { data } = context.getImageData(0, 0, width, height)
    return { width, height, data }
  } finally {
    bitmap.close()
  }
}

/**
Grabs the current frame. No JPEG round trip: the pixels go straight to rectification.
*/
export function videoToPixels(video: HTMLVideoElement): PixelImage {
  const { videoWidth: width, videoHeight: height } = video
  const { context } = createCanvas(width, height)
  context.drawImage(video, 0, 0, width, height)
  const { data } = context.getImageData(0, 0, width, height)
  return { width, height, data }
}

export function drawPixels(canvas: HTMLCanvasElement, image: PixelImage): void {
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (context) {
    context.putImageData(new ImageData(image.data, image.width, image.height), 0, 0)
  }
}

export async function pixelsToJpeg(image: PixelImage, quality: number): Promise<Blob> {
  const { canvas } = createCanvas(image.width, image.height)
  drawPixels(canvas, image)
  return canvasToJpeg(canvas, quality)
}

export async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Could not encode the image'))
        }
      },
      'image/jpeg',
      quality,
    )
  })
}
