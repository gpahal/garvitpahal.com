import { canvasToJpeg } from './downscale'

export type Flip = {
  horizontal: boolean
  vertical: boolean
}

export const NO_FLIP: Flip = { horizontal: false, vertical: false }

export function isFlipped(flip: Flip): boolean {
  return flip.horizontal || flip.vertical
}

/** Previews are transformed rather than re-encoded, so toggling is instant and lossless. */
export function flipTransform(flip: Flip): string | undefined {
  return isFlipped(flip)
    ? `scale(${flip.horizontal ? -1 : 1}, ${flip.vertical ? -1 : 1})`
    : undefined
}

/** Returns the source untouched when there is nothing to flip, so no needless re-encode happens. */
export async function flipImage(source: Blob, flip: Flip): Promise<Blob> {
  if (!isFlipped(flip)) {
    return source
  }

  const bitmap = await createImageBitmap(source)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not get a 2D canvas context')
    }

    // Mirroring alone would draw off-canvas, so each mirrored axis is shifted by its extent.
    context.translate(flip.horizontal ? canvas.width : 0, flip.vertical ? canvas.height : 0)
    context.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
    context.drawImage(bitmap, 0, 0)

    return await canvasToJpeg(canvas)
  } finally {
    bitmap.close()
  }
}
