import * as z from 'zod/mini'

import { capitalize } from '@/lib/text'

/**
 * The dev-only font tester's catalogue: Fontsource and Fontshare, ranked together.
 */

const COLLATOR = new Intl.Collator()

const FONTSOURCE_API_URL = 'https://api.fontsource.org/v1'

const FONTSOURCE_FILES_URL = 'https://cdn.jsdelivr.net/fontsource/fonts'

/**
 * A judgement: Fontshare publishes views rather than downloads, so the two cannot be compared.
 */
const FONTSHARE_TOP_RANK = 5

/**
 * Above 1, so Fontshare's long tail thins out rather than crowding Fontsource's most downloaded.
 */
const FONTSHARE_FALLOFF = 1.5

/**
 * Ids and file URLs go into CSS family names and `url()` sources, so each is held to its source's
 * shape.
 */
const idSchema = z.string().check(z.regex(/^[a-z0-9-]+$/i))

const slugSchema = z.string().check(z.regex(/^[a-z0-9-]+$/))

const nameSchema = z.string().check(z.minLength(1))

const weightSchema = z.int().check(z.gte(1), z.lte(1000))

const styleSchema = z.enum(['normal', 'italic', 'oblique'])

const faceSchema = z.object({
  weight: weightSchema,
  style: styleSchema,
  url: z
    .string()
    .check(
      z.regex(
        /^https:\/\/(?:cdn\.jsdelivr\.net\/fontsource\/fonts|cdn\.fontshare\.com\/wf)\/[\w@./-]+\.woff2$/,
      ),
    ),
})

type FontFaceSource = z.infer<typeof faceSchema>

const testerFontSchema = z.object({
  source: z.enum(['fontsource', 'fontshare']),
  id: idSchema,
  family: nameSchema,
  category: slugSchema,
  faces: z.array(faceSchema).check(z.minLength(1)),
})

/**
 * Carries every file it can load, so a stored choice needs neither list.
 */
export type TesterFont = z.infer<typeof testerFontSchema>

/**
 * Unique across both catalogues, which may share ids.
 */
export function fontKey(font: TesterFont): string {
  return `${font.source}-${font.id}`
}

/**
 * Drops a malformed entry, so one odd font cannot hide the rest.
 */
function parseEach<T>(items: unknown, schema: z.ZodMiniType<T>): Array<T> {
  return Array.isArray(items)
    ? items.flatMap((item) => {
        const result = schema.safeParse(item)
        return result.success ? [result.data] : []
      })
    : []
}

const fontsourceEntrySchema = z.object({
  id: slugSchema,
  family: nameSchema,
  subsets: z.array(slugSchema).check(z.minLength(1)),
  weights: z.array(weightSchema).check(z.minLength(1)),
  styles: z.array(styleSchema).check(z.minLength(1)),
  defSubset: slugSchema,
  category: slugSchema,
})

const downloadsSchema = z.object({ total: z.object({ npmDownloadMonthly: z.number() }) })

const fontshareEntrySchema = z.object({
  slug: idSchema,
  name: nameSchema,
  category: z.string(),
  views_recent: z.number().check(z.gte(0)),
  styles: z.array(
    z.object({
      // Protocol-relative and without an extension; the CSS API serves the same path plus `.woff2`.
      file: z.string().check(z.regex(/^\/\/cdn\.fontshare\.com\/wf\/[A-Z0-9/]+$/)),
      weight: z.object({ weight: z.int() }),
      is_italic: z.boolean(),
      is_variable: z.boolean(),
    }),
  ),
})

/**
 * A combined category such as "Sans, Display" takes its first part.
 */
const FONTSHARE_CATEGORIES: Partial<Record<string, string>> = {
  sans: 'sans-serif',
  serif: 'serif',
  slab: 'serif',
  display: 'display',
  handwritten: 'handwriting',
  script: 'handwriting',
}

/**
 * Body included. The picker waits for all three lists, so a stalled one would block retrying.
 */
const CATALOGUE_TIMEOUT_MS = 10_000

async function fetchJson(fetchFn: typeof fetch, url: string): Promise<unknown> {
  // The signal also ends the body read.
  const response = await fetchFn(url, { signal: AbortSignal.timeout(CATALOGUE_TIMEOUT_MS) })
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`)
  }
  return response.json()
}

export type FontList =
  | {
      status: 'ready'
      fonts: Array<TesterFont>
      notices: Array<string>
    }
  | { status: 'error'; message: string }

/**
 * Only Fontsource's list is required; a notice says what else is missing. `fontshareFontsPath` is
 * the dev server's proxy (`FONTSHARE_FONTS_PATH` in `astro.config.ts`).
 */
export async function loadFontList(
  fetchFn: typeof fetch,
  fontshareFontsPath: string,
): Promise<FontList> {
  const [list, stats, fontshare] = await Promise.allSettled([
    fetchJson(fetchFn, `${FONTSOURCE_API_URL}/fonts`),
    fetchJson(fetchFn, `${FONTSOURCE_API_URL}/stats`),
    fetchJson(fetchFn, fontshareFontsPath),
  ])
  // One subset only: the list carries no `unicodeRange`, so faces for several subsets would each
  // claim every character and the last one added would win. Latin covers the site's text.
  const fontsourceFonts = parseEach(
    list.status === 'fulfilled' ? list.value : undefined,
    fontsourceEntrySchema,
  ).map((entry): TesterFont => {
    const subset = entry.subsets.includes('latin') ? 'latin' : entry.defSubset
    const faces = entry.styles.flatMap((style) =>
      entry.weights.map((weight) => ({
        weight,
        style,
        url: `${FONTSOURCE_FILES_URL}/${entry.id}@latest/${subset}-${weight}-${style}.woff2`,
      })),
    )
    return {
      source: 'fontsource',
      id: entry.id,
      family: entry.family,
      category: entry.category,
      faces,
    }
  })
  if (fontsourceFonts.length === 0) {
    // A `TypeError` is no answer and a `TimeoutError` a slow one; anything else is an answer that
    // trying again at once will not fix.
    const reason: unknown = list.status === 'rejected' ? list.reason : undefined
    const isUnreachable =
      reason instanceof TypeError ||
      (reason instanceof DOMException && reason.name === 'TimeoutError')
    return {
      status: 'error',
      message: isUnreachable
        ? 'The font list could not be loaded from Fontsource. Check your connection and try again'
        : 'Fontsource returned an unexpected font list. Try again later',
    }
  }

  const downloads = new Map<string, number>()
  if (stats.status === 'fulfilled' && typeof stats.value === 'object' && stats.value !== null) {
    for (const [id, entry] of Object.entries(stats.value)) {
      const result = downloadsSchema.safeParse(entry)
      if (result.success) {
        downloads.set(id, result.data.total.npmDownloadMonthly)
      }
    }
  }
  const fontshareBody = fontshare.status === 'fulfilled' ? fontshare.value : undefined
  const fontshareFonts = parseEach(
    typeof fontshareBody === 'object' && fontshareBody !== null && 'fonts' in fontshareBody
      ? fontshareBody.fonts
      : undefined,
    fontshareEntrySchema,
  )
    .map((entry) => {
      // Static styles only: a variable file covers a weight range, which a face per weight cannot
      // describe.
      const faces = entry.styles.flatMap((style) => {
        const face = faceSchema.safeParse({
          weight: style.weight.weight,
          style: style.is_italic ? 'italic' : 'normal',
          url: `https:${style.file}.woff2`,
        })
        return !style.is_variable && face.success ? [face.data] : []
      })
      const category = entry.category.split(',', 1)[0]?.trim().toLowerCase() ?? ''
      const font: TesterFont = {
        source: 'fontshare',
        id: entry.slug,
        family: entry.name,
        category: FONTSHARE_CATEGORIES[category] ?? 'other',
        faces,
      }
      return { font, recentViews: entry.views_recent }
    })
    .filter(({ font }) => font.faces.length > 0)

  // The most viewed Fontshare font scores halfway between the Fontsource fonts either side of
  // `FONTSHARE_TOP_RANK`, so it lands exactly there.
  const scored = fontsourceFonts.map((font) => ({ font, score: downloads.get(font.id) ?? 0 }))
  const ranked = scored.map(({ score }) => score).toSorted((a, b) => b - a)
  const anchor = ((ranked[FONTSHARE_TOP_RANK - 2] ?? 0) + (ranked[FONTSHARE_TOP_RANK - 1] ?? 0)) / 2
  const topViews = Math.max(0, ...fontshareFonts.map(({ recentViews }) => recentViews))
  for (const { font, recentViews } of fontshareFonts) {
    const score = topViews > 0 ? anchor * (recentViews / topViews) ** FONTSHARE_FALLOFF : 0
    scored.push({ font, score })
  }

  const notices: Array<string> = []
  if (downloads.size === 0) {
    notices.push('Download counts could not be loaded, so fonts are listed alphabetically')
  }
  if (fontshareFonts.length === 0) {
    notices.push('Fontshare fonts could not be loaded, so only Fontsource fonts are listed')
  }
  const fonts = scored
    .toSorted((a, b) => {
      const byScore = b.score - a.score
      return byScore === 0 ? COLLATOR.compare(a.font.family, b.font.family) : byScore
    })
    .map(({ font }) => font)
  return { status: 'ready', fonts, notices }
}

export function previewSource(font: TesterFont): FontFaceSource {
  const normalFaces = font.faces.filter((face) => face.style === 'normal')
  const candidates = normalFaces.length > 0 ? normalFaces : font.faces
  return candidates.reduce((nearest, face) =>
    Math.abs(face.weight - 400) < Math.abs(nearest.weight - 400) ? face : nearest,
  )
}

/**
 * A name of its own, so a tested font never merges with a face the site declares under the same
 * family. The applied font and the previews load different faces.
 */
export function familyName(font: TesterFont, use: 'applied' | 'preview'): string {
  return `font-tester-${use}-${fontKey(font)}`
}

const GENERIC_FALLBACKS: Partial<Record<string, string>> = {
  serif: 'serif',
  monospace: 'monospace',
  handwriting: 'cursive',
}

export function familyValue(font: TesterFont, use: 'applied' | 'preview'): string {
  return `"${familyName(font, use)}", ${GENERIC_FALLBACKS[font.category] ?? 'sans-serif'}`
}

export function searchFonts(
  fonts: ReadonlyArray<TesterFont>,
  query: string,
  category: string,
): Array<TesterFont> {
  const needle = query.trim().toLowerCase()
  const inCategory = fonts.filter((font) => category === '' || font.category === category)
  const indexOf = (font: TesterFont): number => font.family.toLowerCase().indexOf(needle)
  return [
    ...inCategory.filter((font) => indexOf(font) === 0),
    ...inCategory.filter((font) => indexOf(font) > 0),
  ]
}

export function fontCategories(fonts: ReadonlyArray<TesterFont>): Array<string> {
  return [...new Set(fonts.map((font) => font.category))].toSorted((a, b) => COLLATOR.compare(a, b))
}

export function categoryLabel(category: string): string {
  return capitalize(category.replaceAll('-', ' '))
}

export function firstFamily(fontFamily: string): string | undefined {
  const family = fontFamily
    .split(',', 1)[0]
    ?.trim()
    .replace(/^(["'])(.*)\1$/, '$2')
  return family === '' ? undefined : family
}

const STORAGE_KEY = 'font-tester:font'

/**
 * The whole font, so the page can apply it before either list is fetched. Storage that refuses
 * access, as in private windows, leaves the choice to this page alone.
 */
export function readStoredFont(): TesterFont | undefined {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    const result = testerFontSchema.safeParse(stored)
    return result.success ? result.data : undefined
  } catch {
    return undefined
  }
}

export function writeStoredFont(font: TesterFont | undefined): void {
  try {
    if (font) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(font))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Kept for this page only.
  }
}
