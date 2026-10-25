import { describe, expect, it } from 'vitest'

import {
  UNREADABLE_FILE_MESSAGE,
  UNREADABLE_HEIC_MESSAGE,
  unreadableFileMessage,
} from './image-header'

/**
 * The start of an ISO base media file: a box size, then `ftyp` and the major brand.
 */
function isoMedia(brand: string): Blob {
  const bytes = new Uint8Array(24)
  bytes.set([0, 0, 0, 24])
  bytes.set(new TextEncoder().encode(`ftyp${brand}`), 4)
  return new Blob([bytes])
}

describe('unreadable file message', () => {
  it.each([
    ['heic', UNREADABLE_HEIC_MESSAGE],
    ['avif', UNREADABLE_FILE_MESSAGE],
  ])('suggests a JPEG export only for a HEIF signature (%s)', async (brand, message) => {
    expect(await unreadableFileMessage(isoMedia(brand))).toBe(message)
  })
})
