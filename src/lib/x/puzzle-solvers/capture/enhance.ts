import { luma, percentile, toGray } from './pixels'
import type { PixelImage } from './pixels'

/**
 * Below this median the picture is a dark theme, whose background flattening would amplify into
 * noise.
 */
const LIGHT_BACKGROUND_MEDIAN = 110

const BACKGROUND_DOWNSAMPLE = 4

/**
 * Wide enough that digits stay ink, narrow enough to follow a shadow. A wider flat fill is
 * flattened away, so `analyzeKenKen` reads filled cells from the unenhanced crop.
 */
const BACKGROUND_RADIUS = 20

/**
 * Past these the fix is louder than the shadow.
 */
const MIN_GAIN = 0.7
const MAX_GAIN = 2.5

const STRETCH_LOW = 0.01
const STRETCH_HIGH = 0.99

const SHARPEN_AMOUNT = 0.5

function boxBlur(plane: Float32Array, width: number, height: number, radius: number): void {
  const temp = new Float32Array(plane.length)
  const window = radius * 2 + 1
  for (let y = 0; y < height; y++) {
    const row = y * width
    let sum = 0
    for (let x = -radius; x <= radius; x++) {
      sum += plane[row + Math.min(width - 1, Math.max(0, x))] ?? 0
    }
    for (let x = 0; x < width; x++) {
      temp[row + x] = sum / window
      const leaving = Math.max(0, x - radius)
      const entering = Math.min(width - 1, x + radius + 1)
      sum += (plane[row + entering] ?? 0) - (plane[row + leaving] ?? 0)
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = -radius; y <= radius; y++) {
      sum += temp[Math.min(height - 1, Math.max(0, y)) * width + x] ?? 0
    }
    for (let y = 0; y < height; y++) {
      plane[y * width + x] = sum / window
      const leaving = Math.max(0, y - radius)
      const entering = Math.min(height - 1, y + radius + 1)
      sum += (temp[entering * width + x] ?? 0) - (temp[leaving * width + x] ?? 0)
    }
  }
}

/**
 * At thumbnail resolution; callers sample it bilinearly.
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
        const sourceY = Math.min(image.height - 1, y * factor + dy)
        for (let dx = 0; dx < factor; dx++) {
          const sourceX = Math.min(image.width - 1, x * factor + dx)
          sum += image.data[(sourceY * image.width + sourceX) * 4 + channel] ?? 0
        }
      }
      plane[y * width + x] = sum / (factor * factor)
    }
  }
  boxBlur(plane, width, height, BACKGROUND_RADIUS)
  for (let i = 0; i < plane.length; i++) {
    plane[i] = Math.min(MAX_GAIN, Math.max(MIN_GAIN, whiteLevel / Math.max(1, plane[i] ?? 0)))
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
    (plane[y0 * width + x0] ?? 0) * (1 - fx) * (1 - fy) +
    (plane[y0 * width + x1] ?? 0) * fx * (1 - fy) +
    (plane[y1 * width + x0] ?? 0) * (1 - fx) * fy +
    (plane[y1 * width + x1] ?? 0) * fx * fy
  )
}

/**
 * Never binarises: thresholding turns thin lines into dashes, and the model was trained on
 * photographs, not masks.
 */
export function enhance(image: PixelImage): PixelImage {
  const { width, height } = image
  const gray = toGray(image)
  const planes: RgbPlanes = [
    extractChannel(image, 0),
    extractChannel(image, 1),
    extractChannel(image, 2),
  ]

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
          plane[y * width + x] = Math.min(255, (plane[y * width + x] ?? 0) * gain)
        }
      }
    }
  }

  // One stretch for all channels, so hues are not shifted.
  const stretched = toGrayPlane(planes, width, height)
  const low = percentile(stretched, STRETCH_LOW)
  const high = Math.max(low + 1, percentile(stretched, STRETCH_HIGH))
  const scale = 255 / (high - low)

  const out = new Uint8ClampedArray(width * height * 4)
  for (const [channel, plane] of planes.entries()) {
    const blurred = Float32Array.from(plane)
    boxBlur(blurred, width, height, 1)
    for (let i = 0; i < width * height; i++) {
      const value = ((plane[i] ?? 0) - low) * scale
      const sharpened = value + SHARPEN_AMOUNT * ((plane[i] ?? 0) - (blurred[i] ?? 0)) * scale
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
    plane[i] = image.data[i * 4 + channel] ?? 0
  }
  return plane
}

type RgbPlanes = [Float32Array, Float32Array, Float32Array]

function toGrayPlane([r, g, b]: RgbPlanes, width: number, height: number): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0; i < gray.length; i++) {
    gray[i] = luma(r[i] ?? 0, g[i] ?? 0, b[i] ?? 0)
  }
  return gray
}
