import { format } from "date-fns";

import type { PostDetails } from "~lib/post";

type BlogPostSummaryProps = {
  post: PostDetails;
};

export default function BlogPostSummary({
  post: {
    slug,
    readingTime: { text: readingTimeText },
    frontmatter: { title, description, publishedTime: date },
  },
}: BlogPostSummaryProps) {
  return (
    <a href={`/blog/${slug}`} className="w-full">
      <div className="mb-10 w-full">
        <div className="flex flex-col justify-between">
          <p className="mb-0.5 text-sm text-gray-600 dark:text-gray-300">
            {format(date, "MMMM dd, yyyy")}
            {" • "}
            {readingTimeText}
          </p>
          <div className="w-full text-lg font-bold text-black dark:text-white md:text-xl">{title}</div>
        </div>
        <p className="mt-1 text-gray-600 dark:text-gray-300">{description}</p>
      </div>
    </a>
  );
}
