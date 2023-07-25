import * as React from 'react'

import type { FlattenedBlogPost } from '@/lib/blog'
import { cn } from '@/lib/styles'

import { BlogPostSummary } from './blog-post-summary'

export type BlogPostSummariesProps = React.HTMLAttributes<HTMLDivElement> & {
  blogPosts: FlattenedBlogPost[]
}

export function BlogPostSummaries({ blogPosts, className, ...props }: BlogPostSummariesProps) {
  return (
    <div {...props} className={cn('space-y-4', className)}>
      {blogPosts.slice(0, 3).map((blogPost) => (
        <BlogPostSummary key={blogPost.path} blogPost={blogPost} />
      ))}
    </div>
  )
}
