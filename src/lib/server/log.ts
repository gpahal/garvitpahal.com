import type { ApiRefusal } from '@/lib/access-session'

type Fields = Record<string, unknown>

/**
 * One JSON object per line, so Workers Logs indexes the fields. `event` goes last so a field of the
 * same name, which may come from a caller, cannot rename it.
 */
function logLine(event: string, fields: Fields): string {
  return JSON.stringify({ ...fields, event })
}

export function logEvent(event: string, fields: Fields): void {
  // eslint-disable-next-line no-console -- the sink every event goes through
  console.log(logLine(event, fields))
}

export function logErrorEvent(event: string, fields: Fields): void {
  console.error(logLine(event, fields))
}

type ScopedLog = (event: string, fields?: Fields) => void

export function scopedLog(
  scope: string,
  requestId: string,
): { log: ScopedLog; logError: ScopedLog } {
  const scoped =
    (write: typeof logEvent): ScopedLog =>
    (event, fields) => {
      write(`${scope}.${event}`, { requestId, ...fields })
    }
  return { log: scoped(logEvent), logError: scoped(logErrorEvent) }
}

export function refusalResponse(
  error: ApiRefusal['error'],
  status: number,
  headers?: HeadersInit,
): Response {
  return Response.json({ error } satisfies ApiRefusal, { status, headers })
}

/**
 * A `cf-ray` is 20 characters; the bound is so a caller cannot choose a log field's length.
 */
const MAX_REQUEST_ID_CHARS = 200

export function getRequestId(request: Request): string {
  const ray = request.headers.get('cf-ray')
  return ray === null || ray === '' ? crypto.randomUUID() : ray.slice(0, MAX_REQUEST_ID_CHARS)
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function elapsedMs(startedAt: number): number {
  return Date.now() - startedAt
}
