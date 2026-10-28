export const SITE_NAME = 'Garvit Pahal'
export const SITE_TAGLINE = 'Building durable systems and AI products'

/**
 * In the sidebar's order. `text` is how the resume prints the link.
 */
export const SOCIAL_LINKS = {
  github: { href: 'https://github.com/gpahal', label: 'GitHub', text: 'github.com/gpahal' },
  linkedin: {
    href: 'https://www.linkedin.com/in/gpahal',
    label: 'LinkedIn',
    text: 'linkedin.com/in/gpahal',
  },
  x: { href: 'https://x.com/g10pahal', label: 'X (Twitter)', text: 'x.com/g10pahal' },
  email: { href: 'mailto:g10pahal@gmail.com', label: 'Email', text: 'g10pahal@gmail.com' },
} as const
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
 * Left out of search results and the sitemap. `/resume-print` is only the resume PDF's source.
 */
export function isUnlistedPath(pathname: string): boolean {
  return (
    isPrivatePath(pathname) ||
    pathname === '/404' ||
    pathname === '/nav' ||
    pathname === '/resume-print'
  )
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
