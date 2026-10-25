import { describe, expect, it } from 'vitest'

import {
  contentSecurityPolicy,
  headersWithPolicy,
  inlineScripts,
  MAX_HEADER_LINE_CHARS,
  scriptHashSource,
} from './content-security-policy'

describe('inlineScripts', () => {
  it('keeps the exact text of scripts without a src', () => {
    const html = [
      '<script type="module" src="/_astro/page.js"></script>',
      '<script>(()=>{ self.Astro = {} })()</script>',
      '<SCRIPT type="module">\n  go()\n</SCRIPT>',
    ].join('')
    expect(inlineScripts(html)).toEqual(['(()=>{ self.Astro = {} })()', '\n  go()\n'])
  })

  it('skips a real src however it is spelled, but not an attribute that merely ends in "src"', () => {
    // A script read as external is never hashed, and the policy then blocks it in built output
    // only, so these are the spellings that have to keep hashing.
    expect(inlineScripts('<script data-src="x">a()</script>')).toEqual(['a()'])
    expect(inlineScripts('<script xsrc="x">b()</script>')).toEqual(['b()'])
    expect(inlineScripts('<script defer SRC = "/a.js"></script>')).toEqual([])
  })

  it('normalises line endings as the HTML parser does before the browser hashes', () => {
    expect(inlineScripts('<script>a()\r\nb()\rc()</script>')).toEqual(['a()\nb()\nc()'])
  })
})

describe('scriptHashSource', () => {
  it('matches the digest a browser computes', async () => {
    // `printf %s "alert(1)" | openssl dgst -sha256 -binary | base64`
    await expect(scriptHashSource('alert(1)')).resolves.toBe(
      "'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='",
    )
  })
})

describe('contentSecurityPolicy', () => {
  it('admits inline script by hash alone and closes what an injected script would reach for', () => {
    const policy = contentSecurityPolicy({
      scriptHashSources: ["'sha256-abc='"],
      connectSources: ['https://a.convex.cloud', 'wss://a.convex.cloud'],
    })
    expect(policy).toContain("script-src 'self' 'sha256-abc=';")
    expect(policy).toContain("connect-src 'self' https://a.convex.cloud wss://a.convex.cloud;")
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'")
    expect(policy).toContain("base-uri 'none'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("frame-ancestors 'none'")
  })
})

// The refusals a real build cannot reach.
describe('headersWithPolicy', () => {
  it('refuses a _headers with no rule to put the policy in', () => {
    // Would otherwise write the file back unchanged and ship with no policy at all.
    expect(() =>
      headersWithPolicy('/x/*\n  X-Robots-Tag: noindex\n', "default-src 'self'"),
    ).toThrow(/needs a `\/\*` rule/)
  })

  it('refuses a line over the cap, which Cloudflare drops silently', () => {
    const hashes = Array.from(
      { length: 200 },
      (_, index) => `'sha256-${String(index)}${'x'.repeat(40)}'`,
    )
    const huge = contentSecurityPolicy({ scriptHashSources: hashes, connectSources: [] })
    expect(huge.length).toBeGreaterThan(MAX_HEADER_LINE_CHARS)
    expect(() => headersWithPolicy('/*\n  A: 1\n', huge)).toThrow(/over Cloudflare's/)
  })
})
