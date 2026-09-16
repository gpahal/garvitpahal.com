import { flipPixels, type PixelImage } from './pixels'

export type Flip = {
  horizontal: boolean
  vertical: boolean
}

export const NO_FLIP: Flip = { horizontal: false, vertical: false }

export function isFlipped(flip: Flip): boolean {
  return flip.horizontal || flip.vertical
}

/**
 * Applied to the pixels rather than as a CSS transform on the preview, so the grid detected and
 * the handles dragged are on the same picture the user sees. Returns the source untouched when
 * there is nothing to flip.
 */
export function flipImage(image: PixelImage, flip: Flip): PixelImage {
  return isFlipped(flip) ? flipPixels(image, flip.horizontal, flip.vertical) : image
}
