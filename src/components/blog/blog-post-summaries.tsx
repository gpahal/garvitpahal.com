import * as React from 'react'

import { MoveRightIcon } from 'lucide-react'

import type { FlattenedBlogPost } from '@/lib/blog'
import { cn } from '@/lib/styles'
import { Link } from '@/components/lib/link'

import { BlogPostSummary } from './blog-post-summary'

export type BlogPostSummariesProps = React.HTMLAttributes<HTMLDivElement> & {
  blogPosts: FlattenedBlogPost[]
  maxBlogPostsVisible?: number
}

export function BlogPostSummaries({ blogPosts, maxBlogPostsVisible, className, ...props }: BlogPostSummariesProps) {
  const visibleBlogPosts = maxBlogPostsVisible ? blogPosts.slice(0, maxBlogPostsVisible) : blogPosts
  const showViewAllBlogPostsLink = maxBlogPostsVisible && blogPosts.length > maxBlogPostsVisible

  return (
    <div {...props} className={cn('-my-2.5', className)}>
      {visibleBlogPosts.map((blogPost) => (
        <BlogPostSummary key={blogPost.path} blogPost={blogPost} />
      ))}
      {showViewAllBlogPostsLink ? (
        <div className="pt-1">
          <Link variant="unstyled" href="/blog" className="group block w-full">
            <span className="-mx-2.5 block rounded-md px-2.5 group-hover:bg-bg-emphasis-3 group-focus-visible:bg-bg-emphasis-3">
              <span className="inline-flex w-full flex-row items-center gap-1.5 py-2">
                <span className="inline-block font-medium">View all posts</span>
                <MoveRightIcon className="inline-block size-3.5 shrink-0" />
              </span>
            </span>
          </Link>
        </div>
      ) : null}
    </div>
  )
}
