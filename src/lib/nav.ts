export type NavLinkItem = {
  id: 'about' | 'blog' | 'blog-rss' | 'work' | 'uses'
  label: string
  description: string
  path: string
  requiresExactMatch?: boolean
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
    description: 'My blog',
    path: '/blog',
  },
  {
    id: 'work',
    label: 'Work',
    description: 'My work history',
    path: '/work',
  },
  {
    id: 'uses',
    label: 'Uses',
    description: 'Tech stack I use daily',
    path: '/uses',
  },
]
