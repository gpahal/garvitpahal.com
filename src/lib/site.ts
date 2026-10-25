export const SITE_NAME = 'Garvit Pahal'
export const SITE_TAGLINE = 'Software engineer interested in technology, football and movies'
/**
 * Matches the `/blog` page's own title, which `src/layouts/layout.astro` builds as `<page> |
 * <site>`.
 */
export const BLOG_FEED_TITLE = `Blog | ${SITE_NAME}`
export const BLOG_DESCRIPTION =
  'Occasional writing by Garvit Pahal on programming and the things he builds'

/**
 * The trailing slash keeps `/xyz` from counting as under `/x`.
 */
export function isAtOrUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isPrivatePath(pathname: string): boolean {
  return isAtOrUnder(pathname, '/x')
}

/**
 * Left out of search results and the sitemap.
 */
export function isUnlistedPath(pathname: string): boolean {
  return isPrivatePath(pathname) || pathname === '/404' || pathname === '/nav'
}

export const PRIVATE_TOOLS = [
  {
    href: '/x/agenda',
    title: 'Agenda',
    subtitle: 'See what today asks: one-off tasks and recurring routines',
  },
  {
    href: '/x/puzzle-solvers',
    title: 'Puzzle solvers',
    subtitle: 'Take a picture of a puzzle and get it solved',
  },
] as const
