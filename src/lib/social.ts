import { SiGithub, SiLinkedin, SiX, type IconType } from '@icons-pack/react-simple-icons'
import { MailIcon } from 'lucide-react'

export const MAIL_LINK = {
  label: 'Email',
  href: 'mailto:g10pahal@gmail.com',
  Icon: MailIcon,
}

export type SocialLink = {
  label: string
  href: string
  Icon: IconType
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    label: 'Twitter',
    href: 'https://twitter.com/g10pahal',
    Icon: SiX,
  },
  {
    label: 'GitHub',
    href: 'https://github.com/gpahal',
    Icon: SiGithub,
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/gpahal/',
    Icon: SiLinkedin,
  },
]
