/**
 * Probes from a signed-out client that Access still covers `/x` and `/api/x`, for
 * [Verify production](../.github/workflows/verify-production.yml). Imports only Node's built-ins,
 * so the workflow needs no install. A 401 carrying the gate's own policy (`WORKER_CSP`) fails:
 * Access let the request through.
 */

import { request as httpRequest } from 'node:http'
import type { IncomingHttpHeaders } from 'node:http'
import { request as httpsRequest } from 'node:https'

/**
 * Bare and nested paths, since an Access destination for `/x/*` does not match `/x`. API probes are
 * GETs, so a missing gate spends nothing.
 */
const PROBES: ReadonlyArray<{ path: string; headers: Record<string, string> }> = [
  ...['/x', '/x/agenda'].map((path) => ({
    path,
    headers: { 'sec-fetch-site': 'none', 'sec-fetch-dest': 'document', accept: 'text/html' },
  })),
  ...['/api/x', '/api/x/token'].map((path) => ({
    path,
    headers: {
      'sec-fetch-site': 'same-origin',
      'sec-fetch-dest': 'empty',
      accept: 'application/json',
    },
  })),
]

/**
 * The gate's own policy, matched whole: `RESPONSE_HEADERS` in `src/lib/server/api-gate.ts`, which a
 * test keeps this equal to.
 */
export const WORKER_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"

type ProbeResponse = { status: number; location?: string; headers: IncomingHttpHeaders }

/**
 * Why `path` is no longer gated, or `undefined` when it is. `teamDomain` must be lower case, as the
 * login redirect names it.
 */
function failure(
  path: string,
  response: ProbeResponse | undefined,
  teamDomain: string,
): string | undefined {
  if (response === undefined) {
    return `No response for ${path}. The site may be down, or the origin is wrong.`
  }
  const { status, location = '' } = response
  if (status === 401) {
    const policy = String(response.headers['content-security-policy'] ?? '').toLowerCase()
    return policy === WORKER_CSP.toLowerCase()
      ? `${path} was answered by the Worker, not Access: the Access application no longer covers it (docs/deployment.md, Setup). The Worker still refuses a request without an Access JWT.`
      : undefined
  }
  if (status >= 300 && status < 400 && location.startsWith(`https://${teamDomain}/`)) {
    return undefined
  }
  const redirect = location === '' ? '' : ` to '${location}'`
  return `${path} answered ${status}${redirect}. Only a 401 or a redirect to ${teamDomain} means Access still covers it (docs/deployment.md, Setup).`
}

async function send(
  path: string,
  headers: Record<string, string>,
  origin: URL,
): Promise<ProbeResponse | undefined> {
  const request = origin.protocol === 'http:' ? httpRequest : httpsRequest
  return new Promise((resolve) => {
    const outgoing = request(
      {
        host: origin.hostname,
        port: origin.port || undefined,
        path,
        headers: { 'user-agent': 'garvitpahal.com verify-access', ...headers },
        signal: AbortSignal.timeout(20_000),
      },
      (response) => {
        response.resume()
        const { location } = response.headers
        resolve({
          status: response.statusCode ?? 0,
          location: location === undefined ? undefined : new URL(location, origin).href,
          headers: response.headers,
        })
      },
    )
    outgoing.on('error', () => {
      resolve(undefined)
    })
    outgoing.end()
  })
}

async function main(): Promise<void> {
  const { ORIGIN = '', ACCESS_TEAM_DOMAIN = '' } = process.env
  const origin = new URL(ORIGIN === '' ? 'https://garvitpahal.com' : ORIGIN)
  const teamDomain = ACCESS_TEAM_DOMAIN.toLowerCase()
  if (teamDomain === '') {
    console.log(
      "::error::ACCESS_TEAM_DOMAIN is unset. Set it as a repository secret (Settings -> Secrets and variables -> Actions -> Secrets) to the Access team domain, <team>.cloudflareaccess.com, so this checks that the site's own login answered rather than any login at all.",
    )
    process.exitCode = 1
    return
  }
  for (const { path, headers } of PROBES) {
    const response = await send(path, headers, origin)
    console.log(`GET ${path} -> ${response?.status ?? 'no response'} ${response?.location ?? ''}`)
    const message = failure(path, response, teamDomain)
    if (message === undefined) {
      continue
    }
    console.log(`::error::${message}`)
    process.exitCode = 1
  }
}

if (import.meta.main) {
  await main()
}
