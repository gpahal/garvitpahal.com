import { GithubIcon, LinkedinIcon, MailIcon, TwitterIcon, type LucideIcon } from 'lucide-react'

export type SocialLink = {
  label: string
  href: string
  Icon: LucideIcon
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    label: 'Email',
    href: 'mailto:g10pahal@gmail.com',
    Icon: MailIcon,
  },
  {
    label: 'Twitter',
    href: 'https://twitter.com/g10pahal',
    Icon: TwitterIcon,
  },
  {
    label: 'GitHub',
    href: 'https://github.com/gpahal',
    Icon: GithubIcon,
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/gpahal/',
    Icon: LinkedinIcon,
  },
]
