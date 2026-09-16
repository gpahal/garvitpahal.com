/**
 * Pure pixel operations over plain typed arrays. Nothing here touches a canvas or `sharp`, so the
 * same code runs in the browser and in a Node bench, and a result is a function of the input alone.
 */

/**
RGBA, row-major, as `ImageData` lays it out. A plain `ArrayBuffer` behind it, as `ImageData` demands.
*/
export type PixelImage = {
  width: number
  height: number
  data: Uint8ClampedArray<ArrayBuffer>
}

/**
One channel, 0..255, row-major.
*/
export type GrayImage = {
  width: number
  height: number
  data: Uint8ClampedArray
}

export function toGray(image: PixelImage): GrayImage {
  const { width, height, data } = image
  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    // Rec. 601 luma, integer weights so the loop stays in integer arithmetic.
    gray[i] = (data[p]! * 77 + data[p + 1]! * 151 + data[p + 2]! * 28) >> 8
  }
  return { width, height, data: gray }
}

/**
 * Box-filter downsample to at most `maxPixels` pixels in total. Never upscales. A pixel budget
 * rather than a longest edge, so a tall phone screenshot keeps as much detail across its width as
 * a landscape photo does. A box filter is enough here: the consumers threshold and project, and
 * do not care about ringing.
 */
export function downsampleGray(gray: GrayImage, maxPixels: number): GrayImage {
  const factor = Math.ceil(Math.sqrt((gray.width * gray.height) / maxPixels))
  if (factor <= 1) {
    return gray
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
          sum += gray.data[offset]!
        }
      }
      out[y * width + x] = sum / area
    }
  }
  return { width, height, data: out }
}

/**
 * Summed-area table with a one-pixel zero border, so a window sum is four lookups. Float64 because
 * a 2048-pixel-wide image of 255s overflows 32 bits.
 */
export function integralImage(gray: GrayImage): Float64Array {
  const { width, height, data } = gray
  const stride = width + 1
  const integral = new Float64Array(stride * (height + 1))
  for (let y = 0; y < height; y++) {
    let rowSum = 0
    for (let x = 0; x < width; x++) {
      rowSum += data[y * width + x]!
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1]! + rowSum
    }
  }
  return integral
}

/**
Mean over the window `[x0, x1) x [y0, y1)`, clamped to the image.
*/
export function windowMean(
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
    integral[by * stride + bx]! -
    integral[ay * stride + bx]! -
    integral[by * stride + ax]! +
    integral[ay * stride + ax]!
  return sum / area
}

/**
 * Per-pixel deviation from the local mean, as an unsigned 0..255 value. Polarity-agnostic on
 * purpose: a puzzle may be dark ink on paper or a bright lattice on a dark screen, and both read
 * as "differs from its surroundings". `radius` sets how local; it should exceed the widest stroke
 * or the stroke becomes its own background.
 */
export function localContrast(gray: GrayImage, radius: number): GrayImage {
  return contrastPlanes(gray, radius).unsigned
}

/**
Whether strokes are darker than their surroundings (ink on paper) or brighter (a dark theme).
*/
export type Polarity = 'dark' | 'bright'

/**
 * Deviation from the local mean in one direction only. Signed rather than absolute because the
 * absolute value puts a halo around every stroke: the mean next to a line is pulled towards the
 * line, so plain background beside it differs from its mean too. Only pixels on the ink side of
 * the mean count, which leaves a stroke exactly as wide as it is drawn.
 */
export function strokeContrast(gray: GrayImage, radius: number, polarity: Polarity): GrayImage {
  const planes = contrastPlanes(gray, radius)
  return polarity === 'dark' ? planes.dark : planes.bright
}

/**
 * The lattice is whatever differs from the background, and the background is most of a crop, so
 * the median says which way the ink goes.
 */
export function guessPolarity(gray: GrayImage): Polarity {
  return percentile(gray.data, 0.5) >= 128 ? 'dark' : 'bright'
}

function contrastPlanes(
  gray: GrayImage,
  radius: number,
): { unsigned: GrayImage; dark: GrayImage; bright: GrayImage } {
  const { width, height, data } = gray
  const integral = integralImage(gray)
  const unsigned = new Uint8ClampedArray(width * height)
  const dark = new Uint8ClampedArray(width * height)
  const bright = new Uint8ClampedArray(width * height)
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
      const difference = data[index]! - mean
      unsigned[index] = Math.abs(difference)
      // Uint8ClampedArray clamps a negative to 0, which is the one-sided value wanted here.
      dark[index] = -difference
      bright[index] = difference
    }
  }
  return {
    unsigned: { width, height, data: unsigned },
    dark: { width, height, data: dark },
    bright: { width, height, data: bright },
  }
}

export function threshold(gray: GrayImage, level: number): Uint8Array {
  const mask = new Uint8Array(gray.data.length)
  for (const [i, value] of gray.data.entries()) {
    mask[i] = value > level ? 1 : 0
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

export type LabelledMask = {
  /**
  Per pixel: `0` for background, otherwise `1 + index` into `components`.
  */
  labels: Int32Array
  components: Array<Component>
}

/**
 * Four-connected flood fill over a binary mask. Iterative, with an explicit stack: a lattice can
 * be hundreds of thousands of pixels and would overflow the call stack recursively.
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

    while (stack.length > 0) {
      const index = stack.pop()!
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
      if (y < height - 1 && mask[index + width] === 1 && labels[index + width] === 0) {
        labels[index + width] = label
        stack.push(index + width)
      }
    }

    components.push(component)
  }

  return { labels, components }
}

/**
 * Mirrors the image in place along either axis. Cheap enough to run on every toggle, which keeps
 * the preview, the quad and the upload all looking at the same pixels.
 */
export function flipPixels(
  image: PixelImage,
  isHorizontal: boolean,
  isVertical: boolean,
): PixelImage {
  const { width, height, data } = image
  const out = new Uint8ClampedArray(data.length)
  for (let y = 0; y < height; y++) {
    const sourceY = isVertical ? height - 1 - y : y
    for (let x = 0; x < width; x++) {
      const sourceX = isHorizontal ? width - 1 - x : x
      const from = (sourceY * width + sourceX) * 4
      const to = (y * width + x) * 4
      out[to] = data[from]!
      out[to + 1] = data[from + 1]!
      out[to + 2] = data[from + 2]!
      out[to + 3] = data[from + 3]!
    }
  }
  return { width, height, data: out }
}

/**
Histogram percentile of a channel, for contrast stretching that ignores outliers.
*/
export function percentile(values: Uint8ClampedArray, fraction: number): number {
  const histogram = new Uint32Array(256)
  for (const value of values) {
    histogram[value]!++
  }
  const target = fraction * values.length
  let seen = 0
  for (let level = 0; level < 256; level++) {
    seen += histogram[level]!
    if (seen >= target) {
      return level
    }
  }
  return 255
}

/**
 * Otsu's threshold over a list of scores, plus how cleanly it separates them. `separation` is the
 * gap between the two clusters as a fraction of the overall range: near 1 means two tight, distant
 * groups, near 0 means a continuum with no natural cut. Callers gate on it rather than trusting
 * the split.
 */
export function splitBimodal(scores: Array<number>): {
  threshold: number
  separation: number
  low: Array<number>
  high: Array<number>
} {
  const sorted = [...scores].sort((a, b) => a - b)
  if (sorted.length < 2) {
    return { threshold: Infinity, separation: 0, low: sorted, high: [] }
  }

  // Otsu over the sorted values: pick the cut maximising between-class variance.
  let bestCut = 1
  let bestVariance = -1
  const total = sorted.reduce((sum, value) => sum + value, 0)
  let lowSum = 0
  for (let cut = 1; cut < sorted.length; cut++) {
    lowSum += sorted[cut - 1]!
    const lowCount = cut
    const highCount = sorted.length - cut
    const lowMean = lowSum / lowCount
    const highMean = (total - lowSum) / highCount
    const variance = lowCount * highCount * (lowMean - highMean) ** 2
    if (variance > bestVariance) {
      bestVariance = variance
      bestCut = cut
    }
  }

  const low = sorted.slice(0, bestCut)
  const high = sorted.slice(bestCut)
  const range = sorted.at(-1)! - sorted[0]!
  const gap = high[0]! - low.at(-1)!
  return {
    threshold: (high[0]! + low.at(-1)!) / 2,
    separation: range === 0 ? 0 : gap / range,
    low,
    high,
  }
}
