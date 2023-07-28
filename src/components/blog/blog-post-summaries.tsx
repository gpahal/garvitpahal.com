import * as React from 'react'

import type { FlattenedBlogPost } from '@/lib/blog'
import { cn } from '@/lib/styles'

import { BlogPostSummary } from './blog-post-summary'

export type BlogPostSummariesProps = React.HTMLAttributes<HTMLDivElement> & {
  blogPosts: FlattenedBlogPost[]
}

export function BlogPostSummaries({ blogPosts, className, ...props }: BlogPostSummariesProps) {
  return (
    <div {...props} className={cn('-my-2 divide-y divide-neutral-6/40', className)}>
      {blogPosts.map((blogPost) => (
        <BlogPostSummary key={blogPost.path} blogPost={blogPost} />
      ))}
    </div>
  )
}
