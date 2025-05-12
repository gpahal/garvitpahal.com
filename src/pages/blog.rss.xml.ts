import type { APIContext } from 'astro'
import { getCollection } from 'astro:content'

import rss from '@astrojs/rss'

export async function GET(context: APIContext) {
  const blog = await getCollection('blog')

  return rss({
    site: context.site!,
    title: `Garvit Pahal | Blog`,
    description: 'Software engineer interested in technology, football and movies.',
    trailingSlash: false,
    stylesheet: '/rss.xsl',
    items: blog.map((post) => ({
      link: `/blog/${post.id}/`,
      title: post.data.title,
      pubDate: post.data.publishedOn,
      categories: post.data.tags || [],
    })),
  })
}
