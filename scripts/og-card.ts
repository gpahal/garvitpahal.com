/**
 * Draws the site's 1200×630 share card to `public/images/og-card.png` with headless Chrome
 * (`pnpm og-card`). Pages without their own `image` share it; rerun after changing the name,
 * tagline or photo, and commit the PNG.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { SITE_NAME, SITE_TAGLINE } from '../src/lib/site.ts'

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const chrome = process.env.CHROME_PATH ?? MAC_CHROME
if (!existsSync(chrome)) {
  throw new Error(`No Chrome at ${chrome}: install Google Chrome or set CHROME_PATH`)
}

const ROOT = path.join(import.meta.dirname, '..')
const OUTPUT = 'public/images/og-card.png'

function dataUrl(file: string, type: string): string {
  return `data:${type};base64,${readFileSync(path.join(ROOT, file)).toString('base64')}`
}

/**
 * `--background`, `--foreground` and `--muted-foreground` from `src/styles/global.css`, light.
 */
const html = `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face {
        font-family: Satoshi;
        src: url('${dataUrl('src/assets/fonts/satoshi/variable.woff2', 'font/woff2')}') format('woff2');
        font-weight: 300 900;
      }
      html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
      body {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 64px;
        padding: 96px;
        background: #ffffff;
        color: #0c0a09;
        font-family: Satoshi, sans-serif;
      }
      h1 { margin: 0; font-size: 88px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
      p { margin: 28px 0 0; font-size: 40px; font-weight: 500; line-height: 1.25; color: #79716b; text-wrap: balance; }
      footer { margin-top: 72px; font-size: 30px; font-weight: 500; color: #79716b; }
      img { width: 300px; height: 300px; flex: none; border-radius: 50%; }
    </style>
  </head>
  <body>
    <main>
      <h1>${SITE_NAME}</h1>
      <p>${SITE_TAGLINE}</p>
      <footer>garvitpahal.com</footer>
    </main>
    <img src="${dataUrl('public/images/self/self-320x320.jpg', 'image/jpeg')}" alt="" />
  </body>
</html>
`

const tmp = path.join(ROOT, 'tmp')
mkdirSync(tmp, { recursive: true })
const page = path.join(tmp, 'og-card.html')
writeFileSync(page, html)
try {
  execFileSync(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1200,630',
      `--screenshot=${path.join(ROOT, OUTPUT)}`,
      pathToFileURL(page).href,
    ],
    { stdio: 'ignore' },
  )
} finally {
  rmSync(page)
}
console.log(`Wrote ${OUTPUT}`)
