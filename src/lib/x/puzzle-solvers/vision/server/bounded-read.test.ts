import { describe, expect, it } from 'vitest'

import { readBoundedText } from './bounded-read'

/**
 * Longer than any of these bodies takes, so only the byte bound decides the cases that pass it.
 */
const NO_TIMEOUT_MS = 60_000

const encoder = new TextEncoder()

/**
 * A chunked body with no declared length, which the header check alone lets through.
 */
function streamed(parts: Array<string>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start: (controller) => {
      for (const part of parts) {
        controller.enqueue(encoder.encode(part))
      }
      controller.close()
    },
  })
}

/**
 * One byte per chunk, so a multi-byte character arrives split across chunks.
 */
function byteByByte(text: string): ReadableStream<Uint8Array> {
  const bytes = encoder.encode(text)
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull: (controller) => {
      if (index >= bytes.byteLength) {
        controller.close()
        return
      }
      controller.enqueue(bytes.slice(index, index + 1))
      index += 1
    },
  })
}

describe('readBoundedText', () => {
  it('reads a body of many tiny chunks in full', async () => {
    const text = `{"grid":"${'1€'.repeat(5000)}"}`
    await expect(
      readBoundedText(byteByByte(text), 1_000_000, NO_TIMEOUT_MS),
    ).resolves.toStrictEqual({ status: 'ok', text })
  })

  it('gives up on a body that trickles in tiny chunks past the deadline', async () => {
    // Keeps sending one byte at a time, never ending and never reaching the cap.
    const body = new ReadableStream<Uint8Array>({
      pull: async (controller) => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        controller.enqueue(encoder.encode('x'))
      },
    })
    await expect(readBoundedText(body, 1_000_000, 20)).resolves.toStrictEqual({
      status: 'timed_out',
    })
  })

  it('refuses a body over the cap that never declared its length', async () => {
    const body = streamed(['x'.repeat(40), 'y'.repeat(40)])
    await expect(readBoundedText(body, 50, NO_TIMEOUT_MS)).resolves.toStrictEqual({
      status: 'too_large',
    })
  })

  it('counts bytes rather than characters, so a multi-byte body cannot slip past', async () => {
    // Four characters, twelve bytes: a cap read as a character count would let this through.
    await expect(readBoundedText(streamed(['€€€€']), 8, NO_TIMEOUT_MS)).resolves.toStrictEqual({
      status: 'too_large',
    })
  })

  it('gives up on a body that stops arriving and never ends', async () => {
    // Opens, sends a little, then never sends again: under any byte cap, indefinitely.
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(encoder.encode('{"a":'))
      },
    })
    await expect(readBoundedText(body, 1024, 5)).resolves.toStrictEqual({ status: 'timed_out' })
  })
})
