/**
 * Nothing here touches a canvas, so the same code runs in the browser and under Node.
 */

/**
 * Laid out as `ImageData`, which demands a plain `ArrayBuffer` behind it.
 */
export type PixelImage = {
  width: number
  height: number
  data: Uint8ClampedArray<ArrayBuffer>
}

/**
 * Detection and warping read RGB only. Mutates the buffer, so decoding needs no second full-size
 * allocation.
 */
export function flattenOnWhite(image: PixelImage): PixelImage {
  const { data } = image
  for (let pixel = 0; pixel < data.length; pixel += 4) {
    const alpha = (data[pixel + 3] ?? 0) / 255
    if (alpha === 1) continue
    for (let channel = 0; channel < 3; channel++) {
      data[pixel + channel] = (data[pixel + channel] ?? 0) * alpha + 255 * (1 - alpha)
    }
    data[pixel + 3] = 255
  }
  return image
}

export type GrayImage = {
  width: number
  height: number
  data: Uint8ClampedArray
}

/**
 * Rec. 601, fractional.
 */
export function luma(r: number, g: number, b: number): number {
  return (r * 77 + g * 151 + b * 28) / 256
}

export function toGray(image: PixelImage): GrayImage {
  const { width, height, data } = image
  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    // Floored rather than rounded as the array would, which the detection thresholds were tuned on.
    gray[i] = Math.floor(luma(data[p] ?? 0, data[p + 1] ?? 0, data[p + 2] ?? 0))
  }
  return { width, height, data: gray }
}

/**
 * Never upscales. A pixel budget rather than a longest edge, so a tall screenshot keeps as much
 * detail across its width as a landscape photo. `factor` is source pixels per output pixel on each
 * axis.
 */
export function downsampleGray(gray: GrayImage, maxPixels: number): GrayImage & { factor: number } {
  const factor = Math.ceil(Math.sqrt((gray.width * gray.height) / maxPixels))
  if (factor <= 1) {
    return { ...gray, factor: 1 }
  }
  const width = Math.floor(gray.width / factor)
  const height = Math.floor(gray.height / factor)
  const out = new Uint8ClampedArray(width * height)
  const area = factor * factor
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let dy = 0; dy < factor; dy++) {
        let offset = (y * factor + dy) * gray.width + x * factor
        for (let dx = 0; dx < factor; dx++, offset++) {
          sum += gray.data[offset] ?? 0
        }
      }
      out[y * width + x] = sum / area
    }
  }
  return { width, height, data: out, factor }
}

/**
 * Float64 so sums stay exact; Float32 loses integers above 2^24.
 */
function integralImage(gray: GrayImage): Float64Array {
  const { width, height, data } = gray
  const stride = width + 1
  const integral = new Float64Array(stride * (height + 1))
  for (let y = 0; y < height; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      rowSum += data[y * width + x] ?? 0
      integral[(y + 1) * stride + x + 1] = (integral[y * stride + x + 1] ?? 0) + rowSum
    }
  }
  return integral
}

function windowMean(
  integral: Float64Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const stride = width + 1
  const ax = Math.max(0, x0)
  const ay = Math.max(0, y0)
  const bx = Math.min(width, x1)
  const by = Math.min(height, y1)
  const area = (bx - ax) * (by - ay)
  if (area <= 0) {
    return 0
  }
  const sum =
    (integral[by * stride + bx] ?? 0) -
    (integral[ay * stride + bx] ?? 0) -
    (integral[by * stride + ax] ?? 0) +
    (integral[ay * stride + ax] ?? 0)
  return sum / area
}

export type Polarity = 'dark' | 'bright'

/**
 * Stroke contrast below this is texture, not a stroke.
 */
export const STROKE_LEVEL = 24

/**
 * One-sided deviation from the local mean, which leaves a stroke as wide as drawn: the absolute
 * value would halo every stroke, since the mean beside a line is pulled towards it.
 */
export function strokeContrast(gray: GrayImage, radius: number, polarity: Polarity): GrayImage {
  const { width, height, data } = gray
  const integral = integralImage(gray)
  const sign = polarity === 'dark' ? -1 : 1
  const out = new Uint8ClampedArray(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mean = windowMean(
        integral,
        width,
        height,
        x - radius,
        y - radius,
        x + radius + 1,
        y + radius + 1,
      )
      const index = y * width + x
      // Uint8ClampedArray clamps a negative to 0, which is the one-sided value wanted here.
      out[index] = sign * ((data[index] ?? 0) - mean)
    }
  }
  return { width, height, data: out }
}

/**
 * Background is most of a crop, so the median says which way the ink goes.
 */
export function guessPolarity(gray: GrayImage): Polarity {
  return percentile(gray.data, 0.5) >= 128 ? 'dark' : 'bright'
}

export function threshold(gray: GrayImage, level: number): Uint8Array {
  const mask = new Uint8Array(gray.data.length)
  for (let i = 0; i < mask.length; i++) {
    mask[i] = (gray.data[i] ?? 0) > level ? 1 : 0
  }
  return mask
}

export type Component = {
  size: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type LabelledMask = {
  /**
   * Per pixel: `0` for background, otherwise `1 + index` into `components`.
   */
  labels: Int32Array
  components: Array<Component>
}

/**
 * Four-connected. Iterative, since a lattice of hundreds of thousands of pixels would overflow the
 * call stack.
 */
export function labelComponents(mask: Uint8Array, width: number, height: number): LabelledMask {
  const labels = new Int32Array(width * height)
  const components: Array<Component> = []
  const stack: Array<number> = []

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] === 0 || labels[start] !== 0) {
      continue
    }
    const label = components.length + 1
    const component: Component = {
      size: 0,
      minX: width,
      minY: height,
      maxX: 0,
      maxY: 0,
    }
    labels[start] = label
    stack.push(start)

    for (let index = stack.pop(); index !== undefined; index = stack.pop()) {
      const x = index % width
      const y = (index - x) / width
      component.size++
      component.minX = Math.min(component.minX, x)
      component.maxX = Math.max(component.maxX, x)
      component.minY = Math.min(component.minY, y)
      component.maxY = Math.max(component.maxY, y)

      if (x > 0 && mask[index - 1] === 1 && labels[index - 1] === 0) {
        labels[index - 1] = label
        stack.push(index - 1)
      }
      if (x < width - 1 && mask[index + 1] === 1 && labels[index + 1] === 0) {
        labels[index + 1] = label
        stack.push(index + 1)
      }
      if (y > 0 && mask[index - width] === 1 && labels[index - width] === 0) {
        labels[index - width] = label
        stack.push(index - width)
      }
      // eslint-disable-next-line unicorn/prefer-continue -- Keeps the four neighbour checks alike
      if (y < height - 1 && mask[index + width] === 1 && labels[index + width] === 0) {
        labels[index + width] = label
        stack.push(index + width)
      }
    }

    components.push(component)
  }

  return { labels, components }
}

export function median(values: Array<number>): number {
  const sorted = values.toSorted((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

export function percentile(values: Uint8ClampedArray, fraction: number): number {
  const histogram = new Uint32Array(256)
  for (const value of values) {
    histogram[value] = (histogram[value] ?? 0) + 1
  }
  const target = fraction * values.length
  let seen = 0
  for (let level = 0; level < 256; level++) {
    seen += histogram[level] ?? 0
    if (seen >= target) {
      return level
    }
  }
  return 255
}

/**
 * Otsu's threshold. `separation` is the gap between the clusters as a fraction of the range, near
 * 0 for a continuum with no natural cut; callers gate on it rather than trusting the split.
 */
export function splitBimodal(scores: Array<number>): {
  threshold: number
  separation: number
  low: Array<number>
  high: Array<number>
} {
  const sorted = scores.toSorted((a, b) => a - b)
  if (sorted.length < 2) {
    return { threshold: Infinity, separation: 0, low: sorted, high: [] }
  }

  let bestCut = 1
  let bestVariance = -1
  const total = sorted.reduce((sum, value) => sum + value, 0)
  let lowSum = 0
  for (let cut = 1; cut < sorted.length; cut++) {
    lowSum += sorted[cut - 1] ?? 0
    const lowCount = cut
    const highCount = sorted.length - cut
    const lowMean = lowSum / lowCount
    const highMean = (total - lowSum) / highCount
    const variance = lowCount * highCount * (lowMean - highMean) ** 2
    if (!(variance > bestVariance)) {
      continue
    }

    bestVariance = variance
    bestCut = cut
  }

  const low = sorted.slice(0, bestCut)
  const high = sorted.slice(bestCut)
  // The cut falls between two scores, so neither side is empty.
  const lowTop = low.at(-1) ?? 0
  const highBottom = high[0] ?? 0
  const range = (sorted.at(-1) ?? 0) - (sorted[0] ?? 0)
  const gap = highBottom - lowTop
  return {
    threshold: (highBottom + lowTop) / 2,
    separation: range === 0 ? 0 : gap / range,
    low,
    high,
  }
}
