import * as React from 'react'
import type { Metadata } from 'next'

import { Analytics } from '@vercel/analytics/react'

import { WEBSITE_URL } from '@/lib/metadata'
import { SOCIAL_LINKS } from '@/lib/social'
import { cn } from '@/lib/styles'
import { Link } from '@/components/lib/link'
import { Nav } from '@/components/nav'

import { RootScripts } from './root-scripts'

import '@/styles/global.css'

export const metadata: Metadata = {
  metadataBase: WEBSITE_URL,
  icons: [
    {
      rel: 'icon',
      type: 'image/jpeg',
      sizes: '64x64',
      url: '/favicon-64x64.jpg',
    },
    {
      rel: 'icon',
      type: 'image/jpeg',
      sizes: '32x32',
      url: '/favicon-32x32.jpg',
    },
    {
      rel: 'shortcut icon',
      type: 'image/x-icon',
      url: '/favicon.ico',
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <RootScripts />
      </head>
      <body>
        <div className="mx-auto flex w-full max-w-[42rem] flex-col px-6 py-4 md:py-6 xl:py-8">
          <div className="border-divider mb-8 md:mb-10">
            <Nav />
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
                    className="group flex-shrink-0 p-1.5 hocus-visible:bg-bg-emphasis-3"
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
