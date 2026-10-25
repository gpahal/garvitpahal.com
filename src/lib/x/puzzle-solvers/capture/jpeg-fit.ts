import { UserFacingError } from '../user-facing-error'

type JpegAttempt = { quality: number; scale: number }

/**
 * High, since tokens depend on pixels, not bytes, and ringing on a thin grid line is the thing to
 * avoid.
 */
const RECTIFIED_JPEG_QUALITY = 0.92

/**
 * Quality drops before any pixels go, since ringing on thin lines costs a read less than losing
 * their width. Hints name cells, not pixels, so they survive a downscale.
 */
const JPEG_ATTEMPTS: ReadonlyArray<JpegAttempt> = [
  { quality: RECTIFIED_JPEG_QUALITY, scale: 1 },
  { quality: 0.85, scale: 1 },
  { quality: 0.75, scale: 1 },
  { quality: 0.65, scale: 1 },
  { quality: 0.65, scale: 0.8 },
  { quality: 0.65, scale: 0.8 ** 2 },
  { quality: 0.65, scale: 0.8 ** 3 },
]

/**
 * Sensor noise makes a crop this large, so better light is the fix; Try again would encode the same
 * picture.
 */
const JPEG_TOO_LARGE_MESSAGE =
  'This picture is too large to send, even at a lower quality and size. Retake it in better light, or choose another picture'

/**
 * Throws rather than return a picture the endpoint would refuse after metering.
 */
export async function fitJpeg(
  encode: (attempt: JpegAttempt) => Promise<Blob>,
  maxBytes: number,
): Promise<Blob> {
  for (const attempt of JPEG_ATTEMPTS) {
    const image = await encode(attempt)
    if (image.size <= maxBytes) return image
  }
  throw new UserFacingError(JPEG_TOO_LARGE_MESSAGE, { noRetry: true })
}
