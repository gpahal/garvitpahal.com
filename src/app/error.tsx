'use client'

import { getErrorMessage } from '@gpahal/std/error'

import { NAV_LINK_ITEMS } from '@/lib/nav'
import { Alert, AlertDescription, AlertTitle } from '@/components/lib/alert'
import { Button } from '@/components/lib/button'
import { H1 } from '@/components/lib/heading'
import { Link } from '@/components/lib/link'

export default function RootErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <header className="mb-5">
        <H1>Something went wrong!</H1>
      </header>
      <div className="prose">
        <p>
          It&apos;rs not you, it&apos;s us. You can try reloading the page and if doesn&apos;t work, you can contact me
          at <Link href="mailto:g10pahal@gmail.com">g10pahal@gmail.com</Link>.<br />
        </p>
        <p>
          <Button variant="primary" onClick={reset}>
            Reload
          </Button>
        </p>
        <Alert variant="error" className="mb-10 mt-6">
          <AlertTitle>Error details</AlertTitle>
          <AlertDescription>{getErrorMessage(error)}</AlertDescription>
        </Alert>
        <hr />
        <p>Still, if nothing works, you can try these links to find what you&apos;re looking for:</p>
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
