/**
 * Bounds a body by bytes received and by total read time before anything parses it:
 * `content-length` is optional and untrusted, and a byte cap alone cannot stop a trickling upload. A
 * body given up on is cancelled, but nothing waits on the cancel, which may never settle.
 */

export type BoundedText =
  { status: 'ok'; text: string } | { status: 'too_large' } | { status: 'timed_out' }

const TIMED_OUT = Symbol('timed out')

function cancelQuietly(cancelling: Promise<void>): void {
  // A refusal means the stream is already gone, which is what the cancel was for.
  cancelling.catch(() => undefined)
}

/**
 * Reads no body, so a route can refuse an obviously oversized one before costly work.
 */
export function isDeclaredOver(request: Request, maxBytes: number): boolean {
  const declaredLength = Number(request.headers.get('content-length') ?? NaN)
  return Number.isFinite(declaredLength) && declaredLength > maxBytes
}

/**
 * No body reads as empty. Rejects when the stream errors, so what arrived before a break is never
 * parsed.
 */
export async function readBoundedText(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  timeoutMs: number,
): Promise<BoundedText> {
  if (!body) return { status: 'ok', text: '' }
  // No time left: a body already buffered would otherwise win its race against a timer set to fire
  // at once.
  if (timeoutMs <= 0) {
    cancelQuietly(body.cancel())
    return { status: 'timed_out' }
  }
  const reader = body.getReader()
  // Decode incrementally to avoid keeping both byte and text copies. Malformed UTF-8 becomes
  // replacement characters, which the request schema may still accept.
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0
  // Armed once rather than per chunk, so a chunk that beats it leaves no timer behind.
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<typeof TIMED_OUT>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(TIMED_OUT)
    }, timeoutMs)
  })
  // Set once the timeout wins, so the drain left running appends nothing more.
  let stopped = false
  const drain = async (): Promise<BoundedText> => {
    for (;;) {
      const { value, done } = await reader.read()
      if (stopped) return { status: 'timed_out' }
      if (done) return { status: 'ok', text: text + decoder.decode() }
      bytes += value.byteLength
      if (bytes > maxBytes) return { status: 'too_large' }
      text += decoder.decode(value, { stream: true })
    }
  }
  const draining = drain()
  let result: BoundedText | typeof TIMED_OUT
  try {
    // Raced once rather than per chunk: each race leaves a reaction on `timedOut` until it settles,
    // so per-chunk races keep memory in proportion to the number of chunks.
    result = await Promise.race([draining, timedOut])
  } finally {
    clearTimeout(timeoutId)
  }
  if (result === TIMED_OUT) {
    stopped = true
    // The pending `read()` ends when the reader is cancelled below, and its outcome no longer matters.
    draining.catch(() => undefined)
    result = { status: 'timed_out' }
  }
  if (result.status !== 'ok') cancelQuietly(reader.cancel())
  return result
}
