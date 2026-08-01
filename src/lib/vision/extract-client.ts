import { blobToBase64 } from '@/lib/capture/base64'
import type { VisionModels } from '@/lib/vision/model'
import type { ExtractResponse } from '@/puzzles/types'

/** What every extraction endpoint accepts. `extractRequestSchema` is the server's own copy. */
export type ExtractRequest = {
  mediaType: string
  /** Base64, without a data-URL prefix. */
  data: string
  models: VisionModels
}

/**
 * The browser half of `createExtractHandler`: post an image, get that puzzle's wire payload back or
 * a message worth showing. Says nothing about what the payload is, so a puzzle maps it to its own
 * type afterwards.
 *
 * Every failure here is one the user can act on - reload, retry, take a better picture - which is
 * why a dead connection and an expired Access session are told apart rather than both surfacing as
 * "something went wrong".
 */
export async function postExtract<TWire>(
  path: string,
  image: Blob,
  models: VisionModels,
): Promise<ExtractResponse<TWire>> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mediaType: image.type || 'image/jpeg',
        data: await blobToBase64(image),
        models,
      } satisfies ExtractRequest),
    })
  } catch {
    return {
      ok: false,
      error: { code: 'network', message: 'Could not reach the server. Check your connection' },
    }
  }

  // Access returns these on an expired session, and its own sign-in page rather than our JSON.
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error: { code: 'network', message: 'Your session expired. Reload the page to sign in again' },
    }
  }

  try {
    return (await response.json()) as ExtractResponse<TWire>
  } catch {
    return {
      ok: false,
      error: { code: 'model_failed', message: 'The server returned an unreadable response' },
    }
  }
}
