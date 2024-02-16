import type { Metadata } from 'next'

import { trim } from '@gpahal/std/string'

export const WEBSITE_TITLE = 'Garvit Pahal'
export const WEBSITE_HOSTNAME = 'garvitpahal.com'
export const WEBSITE_ORGIN = `https://${WEBSITE_HOSTNAME}`
export const WEBSITE_URL = new URL(WEBSITE_ORGIN)

export const AUTHOR_NAME = 'Garvit Pahal'
export const AUTHOR_URL = WEBSITE_URL
export const AUTHOR_TWITTER_USERNAME = '@g10pahal'

export const DEFAULT_IMAGE_PATH = '?v=1'

export function generatePageMetadata({
  pathname,
  title: titleProp,
  browserTitle: browserTitleProp,
  description: descriptionProp,
  article,
}: {
  pathname: string
  title?: string
  browserTitle?: string
  description?: string
  article?: {
    publishedTime: number | Date
    tags?: string[]
  }
}): Partial<Metadata> {
  pathname = trim(pathname || '', '/')
  const url = `${WEBSITE_ORGIN}${pathname ? `/${pathname}` : ''}`

  const title = trim(titleProp || WEBSITE_TITLE)
  const browserTitle = trim(browserTitleProp || title)
  const description = trim(descriptionProp || 'Software engineer interested in technology and football')

  let openGraph: NonNullable<Metadata['openGraph']> = {
    type: article ? 'article' : 'website',
    title,
    description,
    url,
  }
  const twitter: NonNullable<Metadata['twitter']> = {
    card: 'summary',
    title,
    description,
    creator: AUTHOR_TWITTER_USERNAME,
    images: {
      url: `${WEBSITE_ORGIN}/images/self/self-320x320.jpg?v=1`,
      alt: WEBSITE_TITLE,
      type: 'image/jpeg',
      width: 320,
      height: 320,
    },
  }

  const metadata: Partial<Metadata> = {
    metadataBase: WEBSITE_URL,
    title: browserTitle,
    description,
    authors: {
      name: AUTHOR_NAME,
      url: AUTHOR_URL,
    },
    alternates: {
      canonical: url,
    },
    openGraph,
    twitter,
  }
  if (title) {
    metadata.title = browserTitle || title
    openGraph.title = title
    twitter.title = title
  }
  if (description) {
    metadata.description = description
    openGraph.description = description
    twitter.description = description
  }
  if (article) {
    openGraph = {
      ...openGraph,
      type: 'article',
      authors: `${AUTHOR_NAME} (${AUTHOR_URL})`,
      publishedTime: new Date(article.publishedTime).toISOString(),
      tags: article.tags,
    }
    metadata.openGraph = openGraph
  }

  return metadata
}
