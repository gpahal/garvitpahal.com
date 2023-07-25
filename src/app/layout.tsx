import * as React from 'react'
import type { Metadata } from 'next'

import { Analytics } from '@vercel/analytics/react'

import { monoFont, sansSerifFont } from '@/lib/fonts'
import { WEBSITE_URL } from '@/lib/metadata'
import { cn } from '@/lib/styles'

import '@/styles/global.css'

import { NAV_LINK_ITEMS } from '@/lib/nav'
import { SOCIAL_LINKS } from '@/lib/social'
import { Link } from '@/components/lib/link'

import { RootScripts } from './root-scripts'

export const metadata: Metadata = {
  metadataBase: WEBSITE_URL,
  icons: [
    {
      rel: 'icon',
      type: 'image/jpeg',
      sizes: '32x32',
      url: '/images/self/self-32x32.jpg',
    },
    {
      rel: 'icon',
      type: 'image/jpeg',
      sizes: '64x64',
      url: '/images/self/self-64x64.jpg',
    },
    {
      rel: 'shortcut icon',
      type: 'image/x-icon',
      url: '/favicon.icon',
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <RootScripts />
      </head>
      <body className={cn(sansSerifFont.variable, monoFont.variable)} suppressHydrationWarning>
        <div className="mx-auto flex w-full max-w-[42rem] flex-col px-6 py-4 lg:pt-8">
          <div className="border-divider mb-10 lg:mb-12">
            <nav>
              <ul className="mx-[-0.6rem] flex flex-row space-x-0.5">
                {NAV_LINK_ITEMS.map(({ label, path, requiresExactMatch }) => {
                  const inactiveClassName = 'text-fg-subtle hover:text-fg'
                  const activeClassName = 'font-medium text-fg underline'
                  const childActiveClassName = requiresExactMatch ? inactiveClassName : activeClassName
                  return (
                    <li key={label}>
                      <Link
                        variant="hover-highlighted"
                        href={path}
                        className="unstyled inline-block px-2.5 py-0.5 decoration-neutral-5 underline-offset-[6px] hocus-visible:decoration-neutral-6"
                        inactiveClassName={inactiveClassName}
                        activeClassName={activeClassName}
                        childActiveClassName={childActiveClassName}
                      >
                        {label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          </div>
          <main className="relative w-full">
            {children}
            <footer className="border-divider mt-10 flex w-full items-center justify-between border-t pt-3 text-fg-subtle">
              <Link variant="hover-highlighted" href="/" className="font-medium">
                Garvit Pahal
              </Link>
              <div className="-mr-1.5 flex flex-row flex-wrap items-center space-x-1">
                {SOCIAL_LINKS.map(({ label, href, Icon, outlineClassName }) => (
                  <Link
                    key={label}
                    variant="unstyled"
                    href={href}
                    className="group flex-shrink-0 p-1.5 hocus-visible:bg-bg-emphasis"
                  >
                    <Icon
                      aria-label={label}
                      stroke="currentColor"
                      fill="transparent"
                      className={cn('h-4 w-4 rounded-md text-base', outlineClassName)}
                    />
                  </Link>
                ))}
              </div>
            </footer>
          </main>
        </div>

        <Analytics />
      </body>
    </html>
  )
}
