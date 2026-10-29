/**
 * Prints the built `/resume-print` page to `public/docs/resume.pdf` with headless Chrome, after
 * `pnpm resume`'s own build, the only one that has the page.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.join(import.meta.dirname, '..')
const BUILT_PAGES = ['dist/client/resume-print.html', 'dist/client/resume-print/index.html']
const PUBLIC_PDF = 'public/docs/resume.pdf'
const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export type PdfFacts = { pages: number; type3Fonts: number }

/**
 * Read from the raw bytes, which is enough for Chrome's output: it writes page and font
 * dictionaries uncompressed. `/Type /Pages` is the page tree, not a page.
 */
export function pdfFacts(bytes: Uint8Array): PdfFacts {
  const text = new TextDecoder('latin1').decode(bytes)
  return {
    pages: text.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0,
    type3Fonts: text.match(/\/Subtype\s*\/Type3\b/g)?.length ?? 0,
  }
}

/**
 * A Type 3 font extracts as broken words ("Garvi t") and a second page means the content outgrew
 * the layout; either would ship a worse resume than the one it replaces.
 */
export function pdfProblems({ pages, type3Fonts }: PdfFacts): Array<string> {
  return [
    ...(pages === 1 ? [] : [`it has ${pages} pages: shorten the content to fit one A4 page`]),
    ...(type3Fonts === 0
      ? []
      : [`it embeds ${type3Fonts} Type 3 fonts: use a static font, not a variable one`]),
  ]
}

function builtPage(): string {
  const found = BUILT_PAGES.map((page) => path.join(ROOT, page)).find((page) => existsSync(page))
  if (found === undefined) {
    throw new Error(`No built resume at ${BUILT_PAGES.join(' or ')}: run \`pnpm resume\``)
  }
  return found
}

function main(): void {
  const chrome = process.env.CHROME_PATH ?? MAC_CHROME
  if (!existsSync(chrome)) {
    throw new Error(`No Chrome at ${chrome}: install Google Chrome or set CHROME_PATH`)
  }

  const page = builtPage()
  const output = path.join(ROOT, PUBLIC_PDF)
  // Chrome's output is ignored, so a print that fails quietly would leave the old PDF to check.
  rmSync(output, { force: true })
  execFileSync(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${output}`,
      pathToFileURL(page).href,
    ],
    { stdio: 'ignore' },
  )

  const problems = pdfProblems(pdfFacts(readFileSync(output)))
  if (problems.length > 0) {
    throw new Error(`${path.relative(ROOT, output)} is unfit: ${problems.join('; ')}`)
  }
  console.log(`Wrote ${path.relative(ROOT, output)}`)
}

if (import.meta.main) {
  main()
}
