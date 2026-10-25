/**
 * `pnpm convex-guidelines` refreshes `convex/_generated/ai/guidelines.md` alone. `convex ai-files
 * update` would also rewrite `AGENTS.md` and `CLAUDE.md`, so AI files stay disabled in
 * `convex.json` and this fetches what that command does (`downloadGuidelines` in the CLI's
 * `versionApi.js`). It refuses an error page or an empty body, so a moved endpoint never overwrites
 * the committed file.
 */

import { writeFileSync } from 'node:fs'
import path from 'node:path'

const GUIDELINES_URL = 'https://version.convex.dev/v1/guidelines'

const GUIDELINES_PATH = path.join(
  import.meta.dirname,
  '..',
  'convex',
  '_generated',
  'ai',
  'guidelines.md',
)

const response = await fetch(GUIDELINES_URL)
if (!response.ok) {
  throw new Error(`${GUIDELINES_URL} answered ${response.status}`)
}
const type = response.headers.get('content-type') ?? ''
const text = await response.text()
if (!type.startsWith('text/plain') || text.trim() === '') {
  throw new Error(`${GUIDELINES_URL} returned no guidelines (content type ${type || 'none'})`)
}
writeFileSync(GUIDELINES_PATH, text, 'utf8')
console.log(`Wrote ${path.relative(process.cwd(), GUIDELINES_PATH)}`)
