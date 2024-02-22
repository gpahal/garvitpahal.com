export type NavLinkItem = {
  id: 'about' | 'blog' | 'blog-rss' | 'projects' | 'uses' | 'sitemap'
  label: string
  description: string
  path: string
  requiresExactMatch?: boolean
  shouldHideInMainNav?: boolean
}

export const NAV_LINK_ITEMS: NavLinkItem[] = [
  {
    id: 'about',
    label: 'About',
    description: 'About me',
    path: '/',
    requiresExactMatch: true,
  },
  {
    id: 'blog',
    label: 'Blog',
    description: "Blog posts I've written",
    path: '/blog',
  },
  {
    id: 'blog-rss',
    label: 'Blog RSS feed',
    description: 'RSS feed of my blog posts',
    path: '/blog.rss.xml',
    shouldHideInMainNav: true,
  },
  {
    id: 'projects',
    label: 'Projects',
    description: "Projects I've worked on",
    path: '/projects',
  },
  {
    id: 'uses',
    label: 'Uses',
    description: 'Tech stack I use daily',
    path: '/uses',
  },
  {
    id: 'sitemap',
    label: 'Sitemap',
    description: 'Sitemap of this website',
    path: '/sitemap.xml',
    shouldHideInMainNav: true,
  },
]
