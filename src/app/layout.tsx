import * as React from 'react'
import type { Metadata } from 'next'

import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'

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
      <body className={cn(GeistSans.variable, GeistMono.variable)}>
        <div className="relative mx-auto flex w-full max-w-[42rem] flex-col px-6 py-4 sm:py-6">
          <div className="fixed inset-x-0 bottom-0 z-10 bg-bg sm:bottom-auto sm:top-0 sm:py-4 md:py-5">
            <Nav />
          </div>
          <main className="relative mb-10 mt-2 w-full sm:mb-0 sm:mt-[4.5rem] md:mt-20">
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
                    aria-label={label}
                  >
                    <Icon
                      aria-label={label}
                      stroke="currentColor"
                      fill="transparent"
                      className="size-4 rounded-md text-base"
                    />
                  </Link>
                ))}
              </div>
            </footer>
          </main>
        </div>

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
