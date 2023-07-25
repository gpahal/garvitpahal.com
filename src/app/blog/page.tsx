import type { Metadata } from 'next'

import { getTopLevelBlogPosts } from '@/lib/blog.server'
import { generatePageMetadata } from '@/lib/metadata'
import { H1 } from '@/components/lib/heading'
import { BlogPostSummaries } from '@/components/blog/blog-post-summaries'

export const runtime = 'edge'

export const metadata: Metadata = generatePageMetadata({
  pathname: '/blog',
  title: 'Blog - Garvit Pahal',
})

export default function BlogPage() {
  const blogPosts = getTopLevelBlogPosts()

  return (
    <>
      <header className="mb-5">
        <H1>Blog</H1>
      </header>
      <BlogPostSummaries blogPosts={blogPosts} />
    </>
  )
}
