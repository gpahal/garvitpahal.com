import { ConvexHttpClient } from 'convex/browser'
import { ConvexError } from 'convex/values'

/**
 * One Convex call over HTTP with a bearer token, from the browser or the Worker, sorted into the
 * answers its callers tell apart.
 */

/**
 * `rejected` is Convex refusing the token before any function runs (HTTP 401), which for a fresh
 * token means `CONVEX_JWT_JWKS` does not trust its key. `refused` is the function's own refusal, so
 * the token got through. `unreadable` is any other answer, such as a gateway's page. `answered`
 * carries a value the caller must check.
 */
type ConvexHttpResult<T> =
  | { kind: 'unreachable'; error: unknown }
  | { kind: 'rejected' }
  | { kind: 'refused'; error: Error }
  | { kind: 'unreadable'; status: number }
  | { kind: 'answered'; status: number; value: T }

/**
 * Convex's status for a function that threw. `convex/browser` does not export its constant.
 */
const FUNCTION_FAILED_STATUS = 560

export async function callConvexHttp<T>(
  {
    fetchFn,
    convexUrl,
    token,
    timeoutMs,
  }: { fetchFn: typeof fetch; convexUrl: string; token: string; timeoutMs: number },
  call: (client: ConvexHttpClient) => Promise<T>,
): Promise<ConvexHttpResult<T>> {
  // Recorded by the fetch, since the client throws the same `Error` for a 401 as for any other
  // status it does not read.
  let status: number | undefined
  try {
    // A URL that does not parse counts as unreachable. Convex's API sits at the origin's root.
    const client = new ConvexHttpClient(new URL(convexUrl).origin, {
      auth: token,
      logger: false,
      skipConvexDeploymentUrlCheck: true,
      fetch: async (input, init) => {
        const response = await fetchFn(input, {
          ...init,
          cache: 'no-store',
          signal: AbortSignal.timeout(timeoutMs),
        })
        status = response.status
        return response
      },
    })
    const value = await call(client)
    // A value can only follow a response, so the fetch set `status`.
    return { kind: 'answered', status: status ?? 0, value }
  } catch (error) {
    if (status === undefined) {
      return { kind: 'unreachable', error }
    }
    if (status === 401) {
      return { kind: 'rejected' }
    }
    // A refusal without `data` is a bare `Error`; a body that is not JSON, or one cut off
    // mid-read, throws another class.
    return error instanceof ConvexError ||
      (status === FUNCTION_FAILED_STATUS &&
        error instanceof Error &&
        Object.getPrototypeOf(error) === Error.prototype)
      ? { kind: 'refused', error }
      : { kind: 'unreadable', status }
  }
}
