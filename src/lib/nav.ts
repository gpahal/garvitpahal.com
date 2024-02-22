export type NavLinkItem = {
  id: 'about' | 'blog' | 'projects' | 'uses'
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
    description: "Blog posts I've written",
    path: '/blog',
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
]
