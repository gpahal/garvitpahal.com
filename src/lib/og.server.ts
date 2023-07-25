import type { FontWeight } from '@gpahal/font'

const figtreeFontFiles = new Map<FontWeight, URL>([
  [400, new URL('@gpahal/font-data-figtree/files/400-normal.ttf', import.meta.url)],
  [500, new URL('@gpahal/font-data-figtree/files/500-normal.ttf', import.meta.url)],
  [600, new URL('@gpahal/font-data-figtree/files/600-normal.ttf', import.meta.url)],
  [700, new URL('@gpahal/font-data-figtree/files/700-normal.ttf', import.meta.url)],
])

export type FontOptions = {
  name: string
  style: 'normal'
  weight: FontWeight
  data: ArrayBuffer
}

let ogFontsPromise: Promise<FontOptions[]> | undefined

export async function loadOgFonts(): Promise<FontOptions[]> {
  if (ogFontsPromise) {
    return ogFontsPromise
  } else {
    ogFontsPromise = loadOgFontsInternal()
    return ogFontsPromise
  }
}

async function loadOgFontsInternal() {
  const fonts = [] as FontOptions[]
  for (const [weight, url] of Array.from(figtreeFontFiles.entries())) {
    const resp = await fetch(url)
    const data = await resp.arrayBuffer()
    fonts.push({
      name: 'Figtree',
      style: 'normal',
      weight,
      data,
    })
  }
  return fonts
}
