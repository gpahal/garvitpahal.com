import type { Metadata } from 'next'

import { RssIcon } from 'lucide-react'

import { getTopLevelBlogPosts } from '@/lib/blog.server'
import { generatePageMetadata } from '@/lib/metadata'
import { cn } from '@/lib/styles'
import { H1 } from '@/components/lib/heading'
import { Link } from '@/components/lib/link'
import { buttonStyles } from '@/components/lib/styles'
import { BlogPostSummaries } from '@/components/blog/blog-post-summaries'

export const metadata: Metadata = generatePageMetadata({
  pathname: '/blog',
  title: 'Blog - Garvit Pahal',
})

export default function BlogPage() {
  const blogPosts = getTopLevelBlogPosts()

  return (
    <>
      <header className="mb-5 flex items-center justify-between">
        <H1>My blog</H1>
        <Link
          variant="unstyled"
          href="/blog.rss.xml"
          className={cn(buttonStyles({ variant: 'outline', size: 'sm' }), '-mt-1 gap-1.5')}
          aria-label="Blog RSS feed"
        >
          <RssIcon className="size-3.5" />
          RSS
        </Link>
      </header>
      <BlogPostSummaries blogPosts={blogPosts} />
    </>
  )
}
