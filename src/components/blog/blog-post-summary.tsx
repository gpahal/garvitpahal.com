import { format } from 'date-fns'

import type { FlattenedBlogPost } from '@/lib/blog'
import { Link } from '@/components/lib/link'

export type BlogPostSummaryProps = {
  blogPost: FlattenedBlogPost
}

export function BlogPostSummary({
  blogPost: {
    path,
    data: {
      frontmatter: { title, publishedAt },
      readTimeResults,
    },
  },
}: BlogPostSummaryProps) {
  return (
    <div className="py-0.5">
      <Link variant="unstyled" href={`/blog/${path}`} className="group block w-full">
        <span className="-mx-2.5 block rounded-md px-2.5 group-hover:bg-bg-emphasis-3 group-focus-visible:bg-bg-emphasis-3">
          <span className="relative inline-flex w-full flex-col justify-between pb-2.5 pt-2">
            <span className="inline-block font-semimedium">{title}</span>
            <span className="shrink-0 text-sm text-fg-subtle/80">
              {format(publishedAt, 'MMM d, yyyy')} • {readTimeResults.text.replace('read', '').trim()}
            </span>
          </span>
        </span>
      </Link>
    </div>
  )
}
