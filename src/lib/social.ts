import { GithubIcon, LinkedinIcon, MailIcon, TwitterIcon, type LucideIcon } from 'lucide-react'

export type SocialLink = {
  label: string
  href: string
  Icon: LucideIcon
  filledClassName: string
  outlineClassName: string
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    label: 'Email',
    href: 'mailto:g10pahal@gmail.com',
    Icon: MailIcon,
    filledClassName: 'hocus:bg-[#464646] hocus:ring-[#464646] hocus:text-[#ffffff]',
    outlineClassName: 'hover:text-[#464646] group-hover:text-[#464646]',
  },
  {
    label: 'Twitter',
    href: 'https://twitter.com/g10pahal',
    Icon: TwitterIcon,
    filledClassName: 'hocus:bg-[#1da1f2] hocus:ring-[#1da1f2] hocus:text-[#ffffff]',
    outlineClassName: 'hover:text-[#1da1f2] group-hover:text-[#1da1f2]',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/gpahal',
    Icon: GithubIcon,
    filledClassName: 'hocus:bg-[#232323] hocus:ring-[#232323] hocus:text-[#ffffff]',
    outlineClassName: 'hover:text-[#232323] group-hover:text-[#232323]',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/gpahal/',
    Icon: LinkedinIcon,
    filledClassName: 'hocus:bg-[#0a66c2] hocus:ring-[#0a66c2] hocus:text-[#ffffff]',
    outlineClassName: 'hover:text-[#0a66c2] group-hover:text-[#0a66c2]',
  },
]
