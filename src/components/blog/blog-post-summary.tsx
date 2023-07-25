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
      frontmatter: { title, publishedOn },
    },
  },
}: BlogPostSummaryProps) {
  return (
    <Link
      variant="unstyled"
      href={`/blog/${path}`}
      className="group flex w-full items-center justify-between gap-4 no-underline"
    >
      <span className="underline decoration-neutral-5 underline-offset-4 group-hover:decoration-neutral-6 group-focus-visible:decoration-neutral-6">
        {title}
      </span>
      <span className="text-sm text-fg-subtle">{format(publishedOn, 'MMMM dd, yyyy')}</span>
    </Link>
  )
}
