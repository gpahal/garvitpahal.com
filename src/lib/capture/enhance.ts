import { percentile, toGray, type PixelImage } from './pixels'

/**
 * Below this median luminance the picture is a dark theme, not paper in shadow. Dividing a dark
 * background out would amplify it into noise, so flattening is skipped and only the stretch and
 * sharpen run.
 */
const LIGHT_BACKGROUND_MEDIAN = 110

/**
Background is estimated on a thumbnail: it is low-frequency by definition, so nothing is lost.
*/
const BACKGROUND_DOWNSAMPLE = 4

/**
Blur radius on the thumbnail. Must cover a whole cell or the cell's own ink becomes background.
*/
const BACKGROUND_RADIUS = 20

/**
Bounds on how much a shadowed region may be lifted. Past this the fix is louder than the shadow.
*/
const MIN_GAIN = 0.7
const MAX_GAIN = 2.5

const STRETCH_LOW = 0.01
const STRETCH_HIGH = 0.99

const SHARPEN_AMOUNT = 0.5

/**
Box blur via running sums on a float plane, in place.
*/
function boxBlur(plane: Float32Array, width: number, height: number, radius: number): void {
  const temp = new Float32Array(plane.length)
  const window = radius * 2 + 1
  // Horizontal pass.
  for (let y = 0; y < height; y++) {
    const row = y * width
    let sum = 0
    for (let x = -radius; x <= radius; x++) {
      sum += plane[row + Math.min(width - 1, Math.max(0, x))]!
    }
    for (let x = 0; x < width; x++) {
      temp[row + x] = sum / window
      const leaving = Math.max(0, x - radius)
      const entering = Math.min(width - 1, x + radius + 1)
      sum += plane[row + entering]! - plane[row + leaving]!
    }
  }
  // Vertical pass.
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = -radius; y <= radius; y++) {
      sum += temp[Math.min(height - 1, Math.max(0, y)) * width + x]!
    }
    for (let y = 0; y < height; y++) {
      plane[y * width + x] = sum / window
      const leaving = Math.max(0, y - radius)
      const entering = Math.min(height - 1, y + radius + 1)
      sum += temp[entering * width + x]! - temp[leaving * width + x]!
    }
  }
}

/**
 * Per-channel gain map that flattens illumination: a blurred thumbnail of the picture is the
 * estimate of what the paper looks like locally, and each pixel is scaled so that estimate
 * becomes the global white level. Returned at thumbnail resolution; callers sample it bilinearly.
 */
function backgroundGain(
  image: PixelImage,
  channel: number,
  whiteLevel: number,
): { width: number; height: number; gain: Float32Array } {
  const factor = BACKGROUND_DOWNSAMPLE
  const width = Math.max(1, Math.floor(image.width / factor))
  const height = Math.max(1, Math.floor(image.height / factor))
  const plane = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          sum += image.data[((y * factor + dy) * image.width + x * factor + dx) * 4 + channel]!
        }
      }
      plane[y * width + x] = sum / (factor * factor)
    }
  }
  boxBlur(plane, width, height, BACKGROUND_RADIUS)
  for (const [i, value] of plane.entries()) {
    plane[i] = Math.min(MAX_GAIN, Math.max(MIN_GAIN, whiteLevel / Math.max(1, value)))
  }
  return { width, height, gain: plane }
}

function sampleBilinear(
  plane: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const x0 = Math.min(width - 1, Math.max(0, Math.floor(x)))
  const y0 = Math.min(height - 1, Math.max(0, Math.floor(y)))
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const fx = Math.min(1, Math.max(0, x - x0))
  const fy = Math.min(1, Math.max(0, y - y0))
  return (
    plane[y0 * width + x0]! * (1 - fx) * (1 - fy) +
    plane[y0 * width + x1]! * fx * (1 - fy) +
    plane[y1 * width + x0]! * (1 - fx) * fy +
    plane[y1 * width + x1]! * fx * fy
  )
}

/**
 * Photometric clean-up of a rectified crop, colour-preserving: illumination flattening on paper,
 * a percentile contrast stretch, and a mild unsharp mask to restore the crispness resampling took
 * from thin lines. Never binarises - thresholding turns thin lines into dashes, and the model was
 * trained on photographs, not on masks.
 */
export function enhance(image: PixelImage, options: { sharpenAmount?: number } = {}): PixelImage {
  const sharpenAmount = options.sharpenAmount ?? SHARPEN_AMOUNT
  const { width, height } = image
  const gray = toGray(image)
  const planes = [0, 1, 2].map((channel) => extractChannel(image, channel))

  if (percentile(gray.data, 0.5) > LIGHT_BACKGROUND_MEDIAN) {
    const whiteLevel = percentile(gray.data, 0.95)
    for (const [channel, plane] of planes.entries()) {
      const background = backgroundGain(image, channel, whiteLevel)
      const scaleX = background.width / width
      const scaleY = background.height / height
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const gain = sampleBilinear(
            background.gain,
            background.width,
            background.height,
            (x + 0.5) * scaleX - 0.5,
            (y + 0.5) * scaleY - 0.5,
          )
          plane[y * width + x] = Math.min(255, plane[y * width + x]! * gain)
        }
      }
    }
  }

  // One stretch for all channels, from the luminance, so hues are not shifted.
  const stretched = toGrayPlane(planes, width, height)
  const low = percentile(stretched, STRETCH_LOW)
  const high = Math.max(low + 1, percentile(stretched, STRETCH_HIGH))
  const scale = 255 / (high - low)

  const out = new Uint8ClampedArray(width * height * 4)
  for (const [channel, plane] of planes.entries()) {
    const blurred = Float32Array.from(plane)
    boxBlur(blurred, width, height, 1)
    for (const [i, element] of plane.entries()) {
      const value = (element - low) * scale
      const sharpened = value + sharpenAmount * (element - blurred[i]!) * scale
      out[i * 4 + channel] = sharpened
    }
  }
  for (let i = 3; i < out.length; i += 4) {
    out[i] = 255
  }
  return { width, height, data: out }
}

function extractChannel(image: PixelImage, channel: number): Float32Array {
  const plane = new Float32Array(image.width * image.height)
  for (let i = 0; i < plane.length; i++) {
    plane[i] = image.data[i * 4 + channel]!
  }
  return plane
}

function toGrayPlane(
  planes: Array<Float32Array>,
  width: number,
  height: number,
): Uint8ClampedArray {
  const [r, g, b] = planes
  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0; i < gray.length; i++) {
    gray[i] = (r![i]! * 77 + g![i]! * 151 + b![i]! * 28) / 256
  }
  return gray
}

export { type GrayImage } from './pixels'
