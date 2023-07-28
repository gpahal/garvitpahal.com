import type { FlattenedBlog, FlattenedBlogPost } from '@/lib/blog'
import { getFlattenedContentCollectionItemByIndex } from '@/lib/content'
import { cn } from '@/lib/styles'
import { Link } from '@/components/lib/link'

export type BlogPostSeriesTocProps = {
  blog: FlattenedBlog
  blogPost: FlattenedBlogPost
  activeBlogPost: FlattenedBlogPost
  showSeriesTitle?: boolean
  highlightActiveBlogPost?: boolean
}

export function BlogPostSeriesToc({
  blog,
  blogPost,
  activeBlogPost,
  showSeriesTitle,
  highlightActiveBlogPost,
}: BlogPostSeriesTocProps) {
  const reversedChildren = (
    blogPost.childrenIndices
      ? (blogPost.childrenIndices
          .map((index) => getFlattenedContentCollectionItemByIndex(blog, index))
          .filter(Boolean) as FlattenedBlogPost[])
      : []
  ).reverse()

  return reversedChildren.length === 0 ? null : (
    <div className="mx-auto my-8 max-w-lg divide-y divide-neutral-6 rounded border bg-bg-emphasis-2/80">
      {showSeriesTitle ? (
        <div>
          <Link
            variant="unstyled"
            href={`/blog/${blogPost.path}`}
            className="line-clamp-1 px-3 py-2 text-lg font-medium tracking-tight"
          >{`${blogPost.data.frontmatter.title} (${reversedChildren.length} part series)`}</Link>
        </div>
      ) : null}
      <ul className="m-0 divide-y divide-neutral-6 p-0">
        {reversedChildren.map((child, i) => {
          const isActive = child.path === activeBlogPost?.path
          return (
            <li key={child.path} className="m-0 list-none p-0 hocus:bg-bg-emphasis-3">
              <Link
                variant="unstyled"
                href={`/blog/${child.path}`}
                className="flex flex-row items-center space-x-4 px-3 py-2"
              >
                <div
                  className={cn(
                    'flex h-[1.875rem] w-[1.875rem] flex-row items-center justify-center rounded-full text-sm',
                    isActive ? 'border border-fg-subtle text-fg' : 'border border-neutral-6 text-fg-subtle',
                  )}
                >
                  {i + 1}
                </div>
                <span
                  className={cn('line-clamp-1', isActive || !highlightActiveBlogPost ? 'text-fg' : 'text-fg-subtle')}
                >
                  {child.data.frontmatter.title}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
