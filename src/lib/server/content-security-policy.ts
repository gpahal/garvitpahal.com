/**
 * The policy every prerendered page is served under, written into `_headers` by the build
 * (`astro.config.ts`). Not Astro's `security.csp`: under `<ClientRouter />` a swapped-in page runs
 * under the first page's `<meta>` policy, and `@astrojs/cloudflare` lacks `staticHeaders`, so no
 * `frame-ancestors`. Revisit if both change.
 */

const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi

/**
 * Require an attribute boundary: matching `data-src` as `src` would omit a needed inline hash.
 */
const SRC_ATTRIBUTE = /(?:^|\s)src\s*=/i

/**
 * Inline script bodies as the browser hashes them, with CRLF and lone CR as LF. Assumes Astro's
 * built HTML, with no `>` inside an attribute value. A closing script tag ends a script even inside
 * a JavaScript string, so escape it in inline source.
 */
export function inlineScripts(html: string): Array<string> {
  return html
    .matchAll(INLINE_SCRIPT)
    .filter((match) => !SRC_ATTRIBUTE.test(match[1] ?? ''))
    .map((match) => (match[2] ?? '').replaceAll(/\r\n?/g, '\n'))
    .toArray()
}

export async function scriptHashSource(script: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(script))
  return `'sha256-${btoa(String.fromCodePoint(...new Uint8Array(digest)))}'`
}

/**
 * A Convex client uses both HTTP and a WebSocket, and `connect-src` matches the scheme.
 */
export function connectSourcesOf(url: string): Array<string> {
  const { origin } = new URL(url)
  return [origin, origin.replace(/^http/, 'ws')]
}

type PolicyOptions = {
  scriptHashSources: ReadonlyArray<string>
  connectSources: ReadonlyArray<string>
}

/**
 * Inline styles stay allowed for what the build does not hash: Astro's island `<style>`, small
 * stylesheets it inlines and server-rendered `style` attributes. Trusted Types is not enforced:
 * `<ClientRouter />` copies scripts through `innerHTML` (`astro/dist/transitions/router.js`), so it
 * would need a permissive default policy that defeats it.
 */
export function contentSecurityPolicy({
  scriptHashSources,
  connectSources,
}: PolicyOptions): string {
  return [
    ['default-src', "'self'"],
    ['script-src', "'self'", ...scriptHashSources],
    ['worker-src', "'self'"],
    ['style-src', "'self'", "'unsafe-inline'"],
    ['img-src', "'self'", 'data:'],
    ['font-src', "'self'"],
    ['connect-src', "'self'", ...connectSources],
    ['object-src', "'none'"],
    // `'none'`, not `'self'`: nothing writes a `<base>`, and an injected one would re-root every
    // relative URL, including a `/x` page's fetch of the owner's token.
    ['base-uri', "'none'"],
    ['form-action', "'self'"],
    ['frame-ancestors', "'none'"],
  ]
    .map((directive) => directive.join(' '))
    .join('; ')
}

/**
 * The rule `public/_headers` opens with. Matching rules merge and a header set twice is sent
 * comma-joined, so the policy goes into this rule rather than duplicating it in one of its own.
 */
const ALL_PATHS_RULE = /^\/\*$/m

/**
 * https://developers.cloudflare.com/workers/static-assets/headers/
 */
export const MAX_HEADER_LINE_CHARS = 2000

/**
 * `_headers` with the policy in its `/*` rule. Throws on a line over Cloudflare's cap, which
 * Cloudflare drops silently; the policy grows by ~50 characters for each distinct inline script.
 */
export function headersWithPolicy(headers: string, policy: string): string {
  if (!ALL_PATHS_RULE.test(headers)) {
    throw new Error('public/_headers needs a `/*` rule for the Content-Security-Policy')
  }
  const rule = `/*\n  Content-Security-Policy: ${policy}`
  // A function, so a `$` in the policy is never read as a replacement pattern.
  const result = headers.replace(ALL_PATHS_RULE, () => rule)
  const longest = Math.max(...result.split('\n').map((line) => line.length))
  if (longest > MAX_HEADER_LINE_CHARS) {
    throw new Error(
      `A _headers line is ${String(longest)} characters, over Cloudflare's ${String(MAX_HEADER_LINE_CHARS)} limit, so Cloudflare would drop it. If it is the Content-Security-Policy, deduplicate the inline scripts being hashed, or move the policy to a Worker response header`,
    )
  }
  return result
}
