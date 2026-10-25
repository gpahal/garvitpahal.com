import { readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..')

export function filesUnder(dir: string, names: RegExp): Array<string> {
  return readdirSync(path.join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && names.test(entry.name))
    .map((entry) => path.relative(ROOT, path.join(entry.parentPath, entry.name)))
    .map((file) => file.split(path.sep).join('/'))
}

export function routePatterns(): Array<string> {
  return filesUnder('src/pages', /\.(?:astro|mdx?|[cm]?[jt]s)$/).map(
    (file) =>
      `/${file
        .slice('src/pages/'.length)
        .replace(/\.[^.]+$/, '')
        .replace(/(?:^|\/)index$/, '')}`,
  )
}
