import { blobToBase64 } from '@/lib/capture/base64'
import type { VisionModels } from '@/lib/vision/model'
import type { ExtractError, ExtractEvent, ExtractOutcome, ExtractReadMeta } from '@/puzzles/types'

/**
What every extraction endpoint accepts. The endpoint's request schema is the server's own copy.
*/
export type ExtractRequest<THints> = {
  mediaType: string
  /**
  Base64, without a data-URL prefix.
  */
  data: string
  models: VisionModels
  hints: THints
}

export type StreamExtractOptions<TWire> = {
  signal: AbortSignal
  onRead: (wire: TWire, meta: ExtractReadMeta) => void
}

const NDJSON = 'application/x-ndjson'

/**
 * The browser half of `createExtractHandler`: post an image, get every read the server's model
 * chain produces as it arrives, and a verdict on how the stream ended. Says nothing about what a
 * read is, so a puzzle maps it to its own type inside `onRead`.
 *
 * Lines are parsed by hand rather than with zod: both sides are the same build, and zod is not in
 * the browser bundle today. An unknown line type is skipped, so the server may add one later.
 *
 * Every failure here is one the user can act on - reload, retry, take a better picture - which is
 * why a dead connection and an expired Access session are told apart rather than both surfacing as
 * "something went wrong". An abort is not a failure: it rejects, and the caller checks its signal.
 */
export async function streamExtract<TWire, THints>(
  path: string,
  request: { image: Blob; models: VisionModels; hints: THints },
  options: StreamExtractOptions<TWire>,
): Promise<ExtractOutcome> {
  const { signal } = options
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({
        mediaType: request.image.type || 'image/jpeg',
        data: await blobToBase64(request.image),
        models: request.models,
        hints: request.hints,
      } satisfies ExtractRequest<THints>),
    })
  } catch (error) {
    if (signal.aborted) {
      throw error
    }
    return failure('network', 'Could not reach the server. Check your connection')
  }

  // Access returns these on an expired session, and its own sign-in page rather than our JSON.
  if (response.status === 401 || response.status === 403) {
    return failure('network', 'Your session expired. Reload the page to sign in again')
  }

  // Anything refused before the stream opened is a plain JSON error, as before.
  if (!response.headers.get('content-type')?.startsWith(NDJSON)) {
    try {
      const body = (await response.json()) as { ok?: boolean; error?: ExtractError }
      if (body.error) {
        return {
          ok: false,
          error:
            body.error.code === 'invalid_request'
              ? { ...body.error, message: 'This page is out of date. Reload it and try again' }
              : body.error,
        }
      }
    } catch {
      // Not JSON either: fall through to the generic message.
    }
    return failure('model_failed', 'The server returned an unreadable response')
  }
  if (!response.body) {
    return failure('model_failed', 'The server returned an empty response')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let isDelivered = false
  let error: ExtractError | undefined

  const didFinish = (line: string): boolean => {
    let event: ExtractEvent<TWire>
    try {
      event = JSON.parse(line) as ExtractEvent<TWire>
    } catch {
      return false
    }
    switch (event.type) {
      case 'read': {
        isDelivered = true
        options.onRead(event.puzzle, { model: event.model, rank: event.rank })
        return false
      }
      case 'error': {
        error = event.error
        return false
      }
      case 'done': {
        return true
      }
      default: {
        return false
      }
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + 1)
      if (line.trim() !== '' && didFinish(line)) {
        return { ok: true }
      }
      newline = buffer.indexOf('\n')
    }
  }
  // A final line without its newline still counts.
  if (buffer.trim() !== '' && didFinish(buffer)) {
    return { ok: true }
  }

  // The stream ended without `done`: the connection dropped. What arrived is still on screen, so
  // that is only a failure if nothing did.
  if (isDelivered) {
    return { ok: true }
  }
  return error
    ? { ok: false, error }
    : failure('network', 'The connection dropped before the puzzle was read. Try again')
}

function failure(code: ExtractError['code'], message: string): ExtractOutcome {
  return { ok: false, error: { code, message } }
}
