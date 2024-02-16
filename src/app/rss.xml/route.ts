import { Feed } from 'feed'

import { getAllBlogPosts } from '@/lib/blog.server'
import { AUTHOR_NAME, WEBSITE_DESCRIPTION, WEBSITE_IMAGE_URL, WEBSITE_TITLE, WEBSITE_URL } from '@/lib/metadata'

export async function GET() {
  const rssFeed = new Feed({
    title: WEBSITE_TITLE,
    description: WEBSITE_DESCRIPTION,
    id: WEBSITE_URL,
    link: WEBSITE_URL,
    feed: `${WEBSITE_URL}/rss.xml`,
    image: WEBSITE_IMAGE_URL,
    language: 'en',
    copyright: `All rights reserved ${new Date().getFullYear()}, ${AUTHOR_NAME}`,
    generator: 'Custom',
  })

  const blogPosts = getAllBlogPosts()
  for (const blogPost of blogPosts) {
    rssFeed.addItem({
      title: blogPost.data.frontmatter.title,
      description: blogPost.data.frontmatter.description,
      link: `${WEBSITE_URL}/blog/${blogPost.path}`,
      date: new Date(blogPost.data.frontmatter.publishedOn),
      category: blogPost.data.frontmatter.tags.map((tag) => ({ name: tag })),
    })
  }

  return new Response(rssFeed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  })
}
