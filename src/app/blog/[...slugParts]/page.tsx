import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { format } from 'date-fns'

import { getBlog, getBlogPostBySlugParts, getRecommendedBlogPosts } from '@/lib/blog.server'
import { getFlattenedContentCollectionItemByIndex } from '@/lib/content'
import { generatePageMetadata } from '@/lib/metadata'
import { cn } from '@/lib/styles'
import { H1 } from '@/components/lib/heading'
import { Link } from '@/components/lib/link'
import { Balancer } from '@/components/balancer'
import { BlogPostContent } from '@/components/blog/blog-post-content'
import { BlogPostSeriesToc } from '@/components/blog/blog-post-series-toc'
import { BlogPostSummaries } from '@/components/blog/blog-post-summaries'

export const runtime = 'edge'

type BlogPostPageProps = { params: { slugParts: string[] } }

export function generateMetadata({ params: { slugParts } }: BlogPostPageProps): Metadata {
  const blogPost = getBlogPostBySlugParts(slugParts)
  if (!blogPost) {
    return {}
  }

  return generatePageMetadata({
    pathname: `/blog/${blogPost.path}`,
    title: `${blogPost.data.frontmatter.title} - Garvit Pahal`,
    description: blogPost.data.frontmatter.description,
    article: {
      publishedTime: blogPost.data.frontmatter.publishedOn,
      tags: blogPost.data.frontmatter.tags,
    },
  })
}

export default function BlogPostPage({ params: { slugParts } }: BlogPostPageProps) {
  const blogPost = getBlogPostBySlugParts(slugParts)
  if (!blogPost) {
    return notFound()
  }

  const blog = getBlog()
  const parent =
    blogPost.parentIndex != null ? getFlattenedContentCollectionItemByIndex(blog, blogPost.parentIndex) : undefined
  const siblings = parent
    ? parent.childrenIndices
      ? parent.childrenIndices.map((index) => getFlattenedContentCollectionItemByIndex(blog, index)).filter(Boolean)
      : undefined
    : undefined
  const currIndex = siblings ? siblings.findIndex((sibling) => sibling.path === blogPost.path) : -1
  const prev = siblings && currIndex >= 0 && siblings.length > currIndex + 1 ? siblings[currIndex + 1] : undefined
  const next = siblings && currIndex >= 1 ? siblings[currIndex - 1] : undefined
  const recommendedBlogPosts = getRecommendedBlogPosts(blogPost, 3)

  return (
    <>
      <header className="mb-4 flex flex-col">
        <H1>
          <Balancer ratio={0.5}>{blogPost.data.frontmatter.title}</Balancer>
        </H1>
        <p className="mt-1 text-[0.9375rem] text-fg-subtle">
          {format(blogPost.data.frontmatter.publishedOn, 'MMMM dd, yyyy')}
          {' • '}
          {blogPost.data.readTimeResults.text}
        </p>
        {parent ? (
          <div>
            <BlogPostSeriesToc
              blog={blog}
              blogPost={parent}
              activeBlogPost={blogPost}
              showSeriesTitle={true}
              highlightActiveBlogPost={true}
            />
          </div>
        ) : (
          <div className="pb-2" />
        )}
      </header>

      <BlogPostContent blog={blog} blogPost={blogPost} />

      <aside>
        {next || prev ? (
          <div
            className={cn(
              prev ? 'md:flex-row' : 'md:flex-row-reverse',
              'mb-4 mt-8 flex w-full flex-col justify-between',
            )}
          >
            {prev ? (
              <Link
                variant="unstyled"
                href={`/blog/${prev.path}`}
                className="border-divider w-full transform rounded-md border p-1 hocus:bg-bg-emphasis-2 md:mr-2 md:max-w-[47.5%]"
              >
                <div className="h-full px-2.5 pb-1.5 pt-1">
                  <p className="text-sm font-medium text-fg-subtle/80">Prev in the series</p>
                  <p className="leading-[1.325rem] tracking-tight">{prev.data.frontmatter.title}</p>
                </div>
              </Link>
            ) : null}
            {next ? (
              <Link
                variant="unstyled"
                href={`/blog/${next.path}`}
                className={cn(
                  prev ? 'mt-6 md:mt-0' : '',
                  'unstyled border-divider w-full transform rounded-md border p-1 hocus:bg-bg-emphasis-3 md:ml-2 md:max-w-[47.5%]',
                )}
              >
                <div className="h-full px-2.5 pb-1.5 pt-1">
                  <p className="text-sm font-medium text-fg-subtle/80 md:text-right">Next in the series</p>
                  <p className="leading-[1.325rem] tracking-tight md:text-right">{next.data.frontmatter.title}</p>
                </div>
              </Link>
            ) : null}
          </div>
        ) : null}

        {recommendedBlogPosts.length > 0 && (
          <>
            <h2 className="mt-12 text-2xl font-bold tracking-tight">Related</h2>
            <BlogPostSummaries blogPosts={recommendedBlogPosts} className="mt-4" />
          </>
        )}
      </aside>
    </>
  )
}
