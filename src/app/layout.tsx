import * as React from 'react'
import type { Metadata } from 'next'

import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

import { WEBSITE_URL_OBJECT } from '@/lib/metadata'
import { Nav } from '@/components/nav'

import { RootScripts } from './root-scripts'

import '@/styles/global.css'

export const metadata: Metadata = {
  metadataBase: WEBSITE_URL_OBJECT,
  robots: 'index, follow',
  icons: [
    {
      rel: 'icon',
      type: 'image/x-icon',
      sizes: '32x32',
      url: '/favicon.ico',
    },
    {
      rel: 'icon',
      type: 'image/svg+xml',
      url: '/icon.svg',
    },
    {
      rel: 'apple-touch-icon',
      type: 'image/png',
      url: '/apple-touch-icon.png',
    },
  ],
  manifest: '/manifest.webmanifest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="sitemap" type="application/xml" title="Sitemap" href="/sitemap.xml" />
        <link rel="alternate" type="application/rss+xml" title="Blog RSS feed" href="/blog.rss.xml" />

        <RootScripts />
      </head>
      <body>
        <div className="relative flex w-full flex-col px-6 py-4 sm:mx-auto sm:max-w-[42rem]">
          <div className="fixed inset-x-0 bottom-0 z-10 bg-bg sm:bottom-auto sm:top-0 sm:pb-2 md:pb-2.5">
            <Nav />
          </div>
          <main className="relative mb-10 mt-2 w-full sm:mb-0 sm:mt-[4rem] md:mt-[4.5rem]">{children}</main>
        </div>

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
