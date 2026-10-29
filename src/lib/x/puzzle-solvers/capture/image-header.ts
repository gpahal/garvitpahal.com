import { UserFacingError } from '../user-facing-error'

const MAX_SOURCE_BYTES = 32 * 1024 * 1024
/**
 * Admits a 48 MP phone photo; decoding 50 M pixels takes about 200 MB of RGBA.
 */
const MAX_SOURCE_PIXELS = 50_000_000

const view = (bytes: Uint8Array): DataView =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

export type Size = { width: number; height: number }
type Read = (offset: number, length: number) => Promise<Uint8Array>

const TRUNCATED = 'That picture file is incomplete. Choose another picture'
const DAMAGED = 'That picture file is damaged. Choose another picture'

export function validateDimensions({ width, height }: Size): void {
  if (width === 0 || height === 0 || Number.isNaN(width) || Number.isNaN(height)) {
    throw new UserFacingError('That picture is empty. Choose another picture')
  }
  if (width * height > MAX_SOURCE_PIXELS) {
    throw new UserFacingError(
      'That picture is too big to open. Choose a smaller one, or take a screenshot of it',
    )
  }
}

type Header = {
  size: number
  take: (offset: number, length: number) => Promise<Uint8Array>
  hasSignature: (signature: Array<number>, offset?: number) => boolean
  text: (start: number, end: number) => string
}

/**
 * Reads in small pieces, skipping JPEG metadata by offset rather than allocating it.
 */
async function imageDimensions(read: Read, size: number): Promise<Size | undefined> {
  const head = await read(0, Math.min(32, size))
  const header: Header = {
    size,
    take: async (offset, length) => {
      if (offset + length > size) throw new UserFacingError(TRUNCATED)
      const bytes = await read(offset, length)
      if (bytes.length !== length) throw new UserFacingError(TRUNCATED)
      return bytes
    },
    hasSignature: (signature, offset = 0) => signature.every((v, i) => head[offset + i] === v),
    text: (start, end) => String.fromCodePoint(...head.slice(start, end)),
  }
  const dimensions = await headerDimensions(header)
  if (dimensions) validateDimensions(dimensions)
  return dimensions
}

async function headerDimensions(header: Header): Promise<Size | undefined> {
  const { hasSignature, text } = header
  if (hasSignature([137, 80, 78, 71])) return pngDimensions(header)
  if (text(0, 3) === 'GIF') return gifDimensions(header)
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return webpDimensions(header)
  if (hasSignature([255, 216])) return jpegDimensions(header)
  return undefined
}

async function pngDimensions({ take, hasSignature, text }: Header): Promise<Size> {
  const bytes = await take(0, 33)
  if (
    !hasSignature([137, 80, 78, 71, 13, 10, 26, 10]) ||
    text(12, 16) !== 'IHDR' ||
    view(bytes).getUint32(8) !== 13
  )
    throw new UserFacingError(DAMAGED)
  return { width: view(bytes).getUint32(16), height: view(bytes).getUint32(20) }
}

async function gifDimensions({ take, text }: Header): Promise<Size> {
  const bytes = await take(0, 13)
  if (text(0, 6) !== 'GIF87a' && text(0, 6) !== 'GIF89a') throw new UserFacingError(DAMAGED)
  return { width: view(bytes).getUint16(6, true), height: view(bytes).getUint16(8, true) }
}

async function webpDimensions({ take, text, size }: Header): Promise<Size> {
  const kind = text(12, 16)
  const bytes = await take(0, kind === 'VP8L' ? 25 : 30)
  const data = view(bytes)
  if (data.getUint32(4, true) + 8 > size) throw new UserFacingError(TRUNCATED)
  const chunkSize = data.getUint32(16, true)
  if (chunkSize < (kind === 'VP8L' ? 5 : 10) || chunkSize + 20 > size)
    throw new UserFacingError(DAMAGED)
  if (kind === 'VP8X') {
    return {
      width: 1 + (data.getUint32(24, true) & 0xff_ff_ff),
      height: 1 + (data.getUint32(26, true) >>> 8),
    }
  }
  if (kind === 'VP8L' && bytes[20] === 0x2f) {
    const packed = data.getUint32(21, true)
    return { width: 1 + (packed & 0x3f_ff), height: 1 + ((packed >>> 14) & 0x3f_ff) }
  }
  if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
    return {
      width: data.getUint16(26, true) & 0x3f_ff,
      height: data.getUint16(28, true) & 0x3f_ff,
    }
  }
  throw new UserFacingError(DAMAGED)
}

/**
 * C0 to CF but for DHT (C4), JPG (C8) and DAC (CC).
 */
const START_OF_FRAME_MARKERS: ReadonlySet<number> = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])

async function jpegDimensions({ take, size }: Header): Promise<Size> {
  let offset = 2
  for (let segments = 0; segments < 512; segments++) {
    const marker = await take(offset, 4)
    if (marker[0] !== 255) throw new UserFacingError(DAMAGED)
    if (marker[1] === 255) {
      offset++
      continue
    }
    const code = marker[1] ?? 0
    const length = view(marker).getUint16(2)
    if (code === 0xda || code === 0xd9 || length < 2 || offset + 2 + length > size)
      throw new UserFacingError(DAMAGED)
    if (START_OF_FRAME_MARKERS.has(code)) {
      if (length < 8) throw new UserFacingError(DAMAGED)
      const frame = view(await take(offset + 4, 5))
      return { width: frame.getUint16(3), height: frame.getUint16(1) }
    }
    offset += 2 + length
  }
  throw new UserFacingError(
    'That picture file holds too much extra information to open. Choose another picture, or take a screenshot of it',
  )
}

export const UNREADABLE_FILE_MESSAGE = 'That file could not be read. Choose another picture'

/**
 * Most browsers other than Safari cannot decode HEIC.
 */
export const UNREADABLE_HEIC_MESSAGE =
  'That file could not be read. If it is a HEIC photo, export it as a JPEG, then choose that instead'

/**
 * AVIF files may carry the generic brands too, which is why the message says "if".
 */
const HEIF_BRANDS: ReadonlySet<string> = new Set([
  'heic',
  'heix',
  'heim',
  'heis',
  'hevc',
  'hevx',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
])

function isHeifHeader(head: Uint8Array): boolean {
  if (head.length < 12) return false
  const text = String.fromCodePoint(...head.slice(4, 12))
  return text.startsWith('ftyp') && HEIF_BRANDS.has(text.slice(4))
}

/**
 * Falls back to the signature, since a file's type and name are often missing or generic.
 */
export async function unreadableFileMessage(source: Blob): Promise<string> {
  const name = 'name' in source && typeof source.name === 'string' ? source.name : ''
  if (/hei[cf]/i.test(source.type) || /\.hei[cf]$/i.test(name)) return UNREADABLE_HEIC_MESSAGE
  try {
    const head = new Uint8Array(await source.slice(0, 12).arrayBuffer())
    return isHeifHeader(head) ? UNREADABLE_HEIC_MESSAGE : UNREADABLE_FILE_MESSAGE
  } catch {
    return UNREADABLE_FILE_MESSAGE
  }
}

/**
 * Dimensions before orientation, or `undefined` for a format without header preflight.
 */
export async function inspectImage(source: Blob): Promise<Size | undefined> {
  if (source.size > MAX_SOURCE_BYTES)
    throw new UserFacingError(
      `That picture file is over ${String(MAX_SOURCE_BYTES / 1024 / 1024)} MB. Choose a smaller one`,
    )
  return imageDimensions(
    async (offset, length) =>
      new Uint8Array(await source.slice(offset, offset + length).arrayBuffer()),
    source.size,
  )
}
