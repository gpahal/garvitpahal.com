export type NavLinkItem = {
  label: string
  description: string
  path: string
  requiresExactMatch?: boolean
}

export const NAV_LINK_ITEMS: NavLinkItem[] = [
  {
    label: 'about',
    description: 'About me',
    path: '/',
    requiresExactMatch: true,
  },
  {
    label: 'projects',
    description: "Projects I've worked on",
    path: '/projects',
  },
  {
    label: 'blog',
    description: "Blog posts I've written",
    path: '/blog',
  },
  {
    label: 'tech',
    description: 'Tech stack I use daily',
    path: '/uses',
  },
]
