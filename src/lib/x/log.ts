/**
 * One JSON object per line: Workers Logs indexes the fields, so they are filterable in the
 * dashboard. Retention comes from `observability` in `wrangler.jsonc`.
 */

type Fields = Record<string, unknown>

export function logEvent(event: string, fields: Fields): void {
  console.log(JSON.stringify({ event, ...fields }))
}

export function logErrorEvent(event: string, fields: Fields): void {
  console.error(JSON.stringify({ event, ...fields }))
}

/** `cf-ray` ties the lines to Cloudflare's own request record; it is absent under `pnpm dev`. */
export function getRequestId(request: Request): string {
  return request.headers.get('cf-ray') ?? crypto.randomUUID()
}

export function elapsedMs(startedAt: number): number {
  return Date.now() - startedAt
}
