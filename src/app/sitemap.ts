import type { MetadataRoute } from 'next'

import { getAllBlogPosts } from '@/lib/blog.server'
import { WEBSITE_ORGIN } from '@/lib/metadata'

export default function sitemap(): MetadataRoute.Sitemap {
  const blogPosts = getAllBlogPosts()
  const lastModified = new Date()

  return [
    {
      url: `${WEBSITE_ORGIN}`,
      lastModified,
    },
    {
      url: `${WEBSITE_ORGIN}/projects`,
      lastModified,
    },
    {
      url: `${WEBSITE_ORGIN}/blog`,
      lastModified,
    },
    ...blogPosts.map((post) => ({
      url: `${WEBSITE_ORGIN}/blog/${post.path}`,
      lastModified,
    })),
    {
      url: `${WEBSITE_ORGIN}/uses`,
      lastModified,
    },
  ]
}
