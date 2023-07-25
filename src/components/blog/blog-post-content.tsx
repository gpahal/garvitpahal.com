'use client'

import type { FlattenedBlog, FlattenedBlogPost } from '@/lib/blog'
import { Content } from '@/components/content'

import { BlogPostSeriesToc } from './blog-post-series-toc'

export type BlogPostContentProps = {
  blog: FlattenedBlog
  blogPost: FlattenedBlogPost
}

export function BlogPostContent({ blog, blogPost }: BlogPostContentProps) {
  return (
    <div className="prose relative">
      <Content
        content={blogPost.data.content}
        components={{
          SeriesToc: () =>
            blogPost ? (
              <BlogPostSeriesToc
                blog={blog}
                blogPost={blogPost}
                activeBlogPost={blogPost}
                showSeriesTitle={true}
                highlightActiveBlogPost={true}
              />
            ) : null,
        }}
      />
    </div>
  )
}
