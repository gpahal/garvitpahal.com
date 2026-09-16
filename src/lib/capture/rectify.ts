import type { PixelImage } from './pixels'
import { fullFrameQuad, type Quad } from './quad'
import { warpQuadToRect } from './warp'

/**
 * What the capture step hands over: the frame as the user saw it, flips applied, and where they
 * confirmed the grid is. The warp is left to the puzzle, which knows whether it wants the crop,
 * the whole picture, or both.
 */
export type Capture = {
  image: PixelImage
  quad: Quad
}

/**
The grid, upright, long edge at most `maxEdge` and never upscaled.
*/
export function rectify(capture: Capture, maxEdge: number): PixelImage {
  return warpQuadToRect(capture.image, capture.quad, maxEdge)
}

/**
The whole frame, long edge at most `maxEdge` and never upscaled.
*/
export function wholePicture(capture: Capture, maxEdge: number): PixelImage {
  const { width, height } = capture.image
  return warpQuadToRect(capture.image, fullFrameQuad(width, height), maxEdge)
}
