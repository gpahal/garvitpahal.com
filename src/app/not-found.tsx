import type { Metadata } from 'next'

import { generatePageMetadata } from '@/lib/metadata'
import { NAV_LINK_ITEMS } from '@/lib/nav'
import { H1 } from '@/components/lib/heading'
import { Link } from '@/components/lib/link'

export const metadata: Metadata = generatePageMetadata({
  pathname: '/',
})

export default function RootNotFoundPage() {
  return (
    <>
      <header className="mb-5">
        <H1>Page not found</H1>
      </header>
      <div className="prose">
        <p>
          Sorry, the page you&apos;re looking for couldn&apos;t be found. It might have been moved or deleted. You can
          try these links to find what you&apos;re looking for:
        </p>
        <ul>
          {NAV_LINK_ITEMS.map(({ label, description, path }) => (
            <li key={label}>
              <Link href={path}>{description}</Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
