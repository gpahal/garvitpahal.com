import type { ExtractError } from '@/puzzles/types'

/**
 * JSON response helpers shared by every `/api/x` endpoint.
 *
 * `Response.json` sets `content-type` itself, so only the cache header needs stating. Private and
 * uncached is the right default here: these responses are per-user and never worth storing.
 */
export function jsonResponse<TBody>(body: TBody, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'private, no-store',
    },
  })
}

/** Failure arm of an extraction response. Shape matches every puzzle's `*ExtractResponse`. */
export function extractErrorResponse(error: ExtractError, status: number): Response {
  return jsonResponse({ ok: false, error }, status)
}
