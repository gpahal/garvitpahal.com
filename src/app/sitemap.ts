import type { MetadataRoute } from 'next'

import { getAllBlogPosts } from '@/lib/blog.server'
import { WEBSITE_URL } from '@/lib/metadata'

export default function sitemap(): MetadataRoute.Sitemap {
  const blogPosts = getAllBlogPosts()
  const lastModified = new Date()

  return [
    {
      url: `${WEBSITE_URL}`,
      lastModified,
    },
    {
      url: `${WEBSITE_URL}/projects`,
      lastModified,
    },
    {
      url: `${WEBSITE_URL}/blog`,
      lastModified,
    },
    ...blogPosts.map((blogPost) => ({
      url: `${WEBSITE_URL}/blog/${blogPost.path}`,
      lastModified,
    })),
    {
      url: `${WEBSITE_URL}/uses`,
      lastModified,
    },
  ]
}
