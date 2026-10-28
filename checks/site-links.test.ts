import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AGENDA_PATHS } from '@/lib/x/agenda/routes'
import { listPuzzles } from '@/lib/x/puzzle-solvers/puzzles/registry'

import { filesUnder, routePatterns } from './routes'

/**
 * Checks that root-relative links name something the build serves. It sees Markdown links in content
 * and string literals given to `href` or `path`, plus Agenda's `AGENDA_PATHS`; a link built any
 * other way goes unchecked.
 */

const ROOT = path.join(import.meta.dirname, '..')

/**
 * A dynamic route missing here fails the check, so a new one is added rather than skipped.
 */
const PARAM_VALUES: Record<string, () => Array<string>> = {
  // Only direct children, as `src/content.config.ts` loads.
  '/blog/[id]': () =>
    filesUnder('src/content/blog', /\.md$/)
      .filter((file) => path.posix.dirname(file) === 'src/content/blog')
      .map((file) => path.basename(file, '.md')),
  '/x/puzzle-solvers/[puzzle]': () => listPuzzles().map((puzzle) => puzzle.id),
  '/api/x/puzzle-solvers/[puzzle]': () => listPuzzles().map((puzzle) => puzzle.id),
}

const INTEGRATION_OUTPUTS = ['/sitemap-index.xml']

function routes(): Set<string> {
  const served = new Set(INTEGRATION_OUTPUTS)
  for (const route of routePatterns()) {
    const params = /\[([^[\]]+)\]/.exec(route)
    if (params === null) {
      served.add(route)
      continue
    }
    const values = PARAM_VALUES[route]
    if (values === undefined) {
      throw new Error(`Add the values of ${route} to PARAM_VALUES`)
    }
    for (const value of values()) {
      served.add(route.split(params[0]).join(value))
    }
  }
  // Cloudflare never serves underscore files such as `_headers`.
  for (const file of filesUnder('public', /^[^_]/)) {
    served.add(file.slice('public'.length))
  }
  return served
}

const MARKDOWN_LINK = /\]\((\/[^)\s]*)\)/g
const HREF = /(?:href|path)(?:=|:\s*)(?:"(\/[^"]*)"|'(\/[^']*)'|\{'(\/[^']*)'\})/g

function rootRelativeLinks(text: string, pattern: RegExp): Array<string> {
  return text
    .matchAll(pattern)
    .map((match) => match[1] ?? match[2] ?? match[3] ?? '')
    .filter((link) => link !== '' && !link.startsWith('//'))
    .map((link) => (link.split(/[?#]/, 1)[0] ?? '') || '/')
    .toArray()
}

describe('root-relative links', () => {
  it('name a route, a public file or an integration output', () => {
    const sources = [
      ...filesUnder('src/content', /\.md$/).map((file) => ({ file, pattern: MARKDOWN_LINK })),
      ...filesUnder('src', /\.(?:astro|tsx?)$/).map((file) => ({ file, pattern: HREF })),
    ]
    const links = sources.flatMap(({ file, pattern }) =>
      rootRelativeLinks(readFileSync(path.join(ROOT, file), 'utf8'), pattern).map((link) => ({
        file,
        link,
      })),
    )
    const tabled = Object.values(AGENDA_PATHS).map((link) => ({
      file: 'src/lib/x/agenda/routes.ts',
      link,
    }))
    // Catch a pattern that stops matching, which would pass with nothing to check.
    for (const extension of ['.md', '.astro', '.ts', '.tsx']) {
      expect(
        links.some(({ file }) => file.endsWith(extension)),
        extension,
      ).toBe(true)
    }

    const served = routes()
    const broken = [...links, ...tabled]
      .filter(({ link }) => !served.has(link))
      .map(({ file, link }) => `${file}: ${link}`)
    expect(broken).toStrictEqual([])
  })
})
