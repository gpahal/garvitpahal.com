const JPEG_QUALITY = 0.85

/**
 * Both capture paths converge here, so an uploaded file and a camera frame produce identical
 * payloads for the endpoint. Keeps the long edge at `maxEdge` and never upscales.
 */
export async function downscaleToJpeg(source: Blob, maxEdge: number): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  try {
    const longEdge = Math.max(bitmap.width, bitmap.height)
    const scale = longEdge > maxEdge ? maxEdge / longEdge : 1
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not get a 2D canvas context')
    }
    context.drawImage(bitmap, 0, 0, width, height)

    return await canvasToJpeg(canvas)
  } finally {
    bitmap.close()
  }
}

export async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
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
      JPEG_QUALITY,
    )
  })
}
