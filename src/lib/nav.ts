export type NavLinkItem = {
  label: string
  description: string
  path: string
  requiresExactMatch?: boolean
}

export const NAV_LINK_ITEMS: NavLinkItem[] = [
  {
    label: 'About',
    description: 'About me',
    path: '/',
    requiresExactMatch: true,
  },
  {
    label: 'Projects',
    description: "Projects I've worked on",
    path: '/projects',
  },
  {
    label: 'Blog',
    description: "Blog posts I've written",
    path: '/blog',
  },
  {
    label: 'Uses',
    description: 'Tech stack I use daily',
    path: '/uses',
  },
]
