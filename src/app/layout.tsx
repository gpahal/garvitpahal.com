import * as React from 'react'
import type { Metadata } from 'next'

import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'

import { WEBSITE_URL_OBJECT } from '@/lib/metadata'
import { SOCIAL_LINKS } from '@/lib/social'
import { cn } from '@/lib/styles'
import { Link } from '@/components/lib/link'
import { buttonStyles } from '@/components/lib/styles'
import { Nav } from '@/components/nav'

import { RootScripts } from './root-scripts'

import '@/styles/global.css'

export const metadata: Metadata = {
  metadataBase: WEBSITE_URL_OBJECT,
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
  robots: 'index, follow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml" />
        <link rel="alternate" type="application/rss+xml" title="RSS" href="/rss.xml" />

        <RootScripts />
      </head>
      <body className={cn(GeistSans.variable, GeistMono.variable)}>
        <div className="relative flex w-full flex-col px-6 py-4 sm:mx-auto sm:max-w-[42rem] sm:py-6">
          <div className="fixed inset-x-0 bottom-0 z-10 bg-bg sm:bottom-auto sm:top-0 sm:pb-3 sm:pt-4 md:pb-3.5 md:pt-5">
            <Nav />
          </div>
          <main className="relative mb-10 mt-2 w-full sm:mb-0 sm:mt-[4rem] md:mt-[4.5rem]">
            {children}
            <footer className="border-divider mt-10 flex w-full items-center justify-between gap-4 border-t pt-1.5">
              <div className="-ml-2 flex items-center gap-0.5 text-fg-subtle">
                <Link
                  variant="unstyled"
                  href="/rss.xml"
                  className={cn(buttonStyles({ variant: 'ghost', size: 'sm' }), 'h-7 px-2 text-fg-subtle')}
                >
                  RSS
                </Link>
                <span>•</span>
                <Link
                  variant="unstyled"
                  href="/sitemap.xml"
                  className={cn(buttonStyles({ variant: 'ghost', size: 'sm' }), 'h-7 px-2 text-fg-subtle')}
                >
                  Sitemap
                </Link>
              </div>
              <div className="-mr-2 flex flex-row flex-wrap items-center gap-1">
                {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                  <Link
                    key={label}
                    variant="unstyled"
                    href={href}
                    className={cn(
                      buttonStyles({ variant: 'ghost', size: 'sm', shape: 'square' }),
                      'flex-shrink-0 !font-normal text-fg-subtle',
                    )}
                    aria-label={label}
                  >
                    <Icon aria-label={label} stroke="currentColor" fill="transparent" className="size-4 text-base" />
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
