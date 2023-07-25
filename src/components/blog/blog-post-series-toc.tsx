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
    <div className="bg-subtle divide-divider border-divider mx-auto my-2 max-w-lg divide-y rounded border">
      {showSeriesTitle ? (
        <div>
          <Link
            variant="unstyled"
            href={`/blog/${blogPost.path}`}
            className="line-clamp-1 px-3 py-2 text-lg font-medium tracking-tight"
          >{`${blogPost.data.frontmatter.title} (${reversedChildren.length} part series)`}</Link>
        </div>
      ) : null}
      <ul className="divide-divider m-0 divide-y p-0">
        {reversedChildren.map((child, i) => {
          const isActive = child.path === activeBlogPost?.path
          return (
            <li key={child.path} className="m-0 list-none p-0">
              <Link
                variant="unstyled"
                href={`/blog/${child.path}`}
                className="flex flex-row items-center space-x-4 px-3 py-2"
              >
                <div
                  className={cn(
                    'bg-bg-subtle flex h-[1.875rem] w-[1.875rem] flex-row items-center justify-center rounded-full text-sm',
                    isActive ? 'border border-fg-subtle text-fg' : 'border-divider border text-fg-subtle',
                  )}
                >
                  {i + 1}
                </div>
                <span
                  className={cn(
                    'line-clamp-1',
                    isActive || !highlightActiveBlogPost ? 'text-fg' : 'text-fg-subtle',
                    isActive ? 'font-medium' : 'font-normal',
                  )}
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
