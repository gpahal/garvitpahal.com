import * as React from 'react'
import type { Metadata } from 'next'

import { Analytics } from '@vercel/analytics/react'

import { monoFont, sansSerifFont } from '@/lib/font'
import { WEBSITE_URL } from '@/lib/metadata'
import { SOCIAL_LINKS } from '@/lib/social'
import { cn } from '@/lib/styles'
import { Link } from '@/components/lib/link'
import { buttonStyles } from '@/components/lib/styles'
import { Nav } from '@/components/nav'

import { RootScripts } from './root-scripts'

import '@/styles/global.css'

export const metadata: Metadata = {
  metadataBase: WEBSITE_URL,
  icons: [
    {
      rel: 'icon',
      type: 'image/png',
      url: '/favicon.png',
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
      <body className={cn(sansSerifFont.variable, monoFont.variable)}>
        <div className="mx-auto flex w-full max-w-[42rem] flex-col px-6 py-4 sm:py-6">
          <div className="border-divider mb-10 pb-1.5 md:mb-12">
            <Nav />
          </div>
          <main className="relative w-full">
            {children}
            <footer className="border-divider mt-10 flex w-full items-center justify-between gap-4 border-t pt-2">
              <span className="-ml-2 inline-flex">
                <Link
                  variant="unstyled"
                  href="/"
                  className={cn(buttonStyles({ variant: 'ghost', size: 'sm' }), 'h-7 px-2 text-fg-subtle')}
                >
                  Garvit Pahal
                </Link>
              </span>
              <div className="-mr-2 flex flex-row flex-wrap items-center gap-1">
                {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                  <Link
                    key={label}
                    variant="unstyled"
                    href={href}
                    className={cn(
                      buttonStyles({ variant: 'ghost', size: 'sm', shape: 'square' }),
                      'flex-shrink-0 text-fg-subtle',
                    )}
                  >
                    <Icon
                      aria-label={label}
                      stroke="currentColor"
                      fill="transparent"
                      className="h-4 w-4 rounded-md text-base"
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
