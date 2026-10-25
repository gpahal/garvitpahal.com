import type { APIContext } from 'astro'

import rss from '@astrojs/rss'

import { listBlogPosts } from '@/lib/blog'
import { dateOnlyToUtc } from '@/lib/dates'
import { BLOG_DESCRIPTION, BLOG_FEED_TITLE } from '@/lib/site'

export async function GET(context: APIContext) {
  // Every feed link is absolute, so a missing `site` must stop the build.
  if (!context.site) {
    throw new Error('`site` must be set in astro.config.ts for the blog feed to have links')
  }

  const feedUrl = new URL(context.url.pathname, context.site).href
  return rss({
    // Also the channel's own link. Root-relative item links resolve against the origin alone.
    site: new URL('/blog', context.site),
    title: BLOG_FEED_TITLE,
    description: BLOG_DESCRIPTION,
    trailingSlash: false,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: `<language>en-gb</language><atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>`,
    items: (await listBlogPosts()).map((post) => ({
      link: `/blog/${post.id}`,
      title: post.data.title,
      description: post.data.description,
      pubDate: dateOnlyToUtc(post.data.publishedOn),
      categories: post.data.tags,
    })),
  })
}
