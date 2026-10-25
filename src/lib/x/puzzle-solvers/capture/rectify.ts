import { UserFacingError } from '../user-facing-error'
import type { PixelImage } from './pixels'
import { isUsableQuad } from './quad'
import type { Quad } from './quad'
import { marginQuad, warpQuadToRect } from './warp'

/**
 * The frame as the user saw it, turns and mirrors applied. The warp is left to the puzzle, which
 * knows the crop it wants.
 */
export type Capture = {
  image: PixelImage
  quad: Quad
}

export const DRAG_CORNERS_MESSAGE =
  'The corners are out of place. Drag each one onto its corner of the grid'

export const RECHOOSE_CORNERS_MESSAGE =
  'The corners were out of place. Choose the picture again and drag each one onto its corner ' +
  'of the grid'

/**
 * `margin` is a share of the grid's size, inside `maxEdge`. Throws on unusable corners, which the
 * review step should already have refused.
 */
export function rectify(capture: Capture, maxEdge: number, margin = 0): PixelImage {
  const { image, quad } = capture
  if (!isUsableQuad(quad, image.width, image.height)) {
    throw new UserFacingError(RECHOOSE_CORNERS_MESSAGE, { noRetry: true })
  }
  return warpQuadToRect(image, margin > 0 ? marginQuad(quad, margin) : quad, maxEdge)
}
