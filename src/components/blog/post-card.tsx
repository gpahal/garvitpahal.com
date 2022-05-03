import clsx from "clsx";

import type { PostDetails } from "~lib/post";

type BlogPostCardProps = {
  post: PostDetails;
  gradient: string;
};

export default function BlogPostCard({
  post: {
    slug,
    frontmatter: { title },
    readingTime: { text: readingTimeText },
  },
  gradient,
}: BlogPostCardProps) {
  return (
    <a
      href={`/blog/${slug}`}
      className={clsx(
        "w-full transform rounded-xl bg-gradient-to-r p-1 transition-all hover:scale-[1.01] md:w-1/3",
        gradient,
      )}
    >
      <div className="flex h-full flex-col justify-between rounded-lg bg-white p-4 dark:bg-gray-900">
        <div className="flex flex-col justify-between md:flex-row">
          <h3 className="mb-4 w-full text-lg font-medium tracking-tight text-gray-900 dark:text-gray-100 sm:mb-6 md:text-lg">
            {title}
          </h3>
        </div>
        <div className="flex items-center text-gray-500 dark:text-gray-300">
          <span className="align-baseline">{readingTimeText}</span>
        </div>
      </div>
    </a>
  );
}
