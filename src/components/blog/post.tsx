import clsx from "clsx";
import { format } from "date-fns";
import { getMDXComponent } from "mdx-bundler/client/index.js";
import { useMemo } from "react";

import PostSeriesTOC from "~/components/blog/post-series-toc";
import PostSummary from "~components/blog/post-summary";
import Container from "~components/container";

import type { PostDetails } from "~lib/post";

export type PostProps = {
  currentUrl: URL;
  post: PostDetails;
  recommendations: PostDetails[];
};

export default function Post({ currentUrl, post, recommendations }: PostProps) {
  const isSeries = post.children && post.children.length > 0;
  const isInSeries = !!post.parent;
  const PostSeriesTOCLocal = useMemo(() => (isSeries ? () => PostSeriesTOC({ post }) : () => null), [isSeries, post]);

  const Component = useMemo(() => {
    const Component = getMDXComponent(post.code);
    function CustomMDXComponent({ components, ...rest }: Parameters<typeof Component>["0"]) {
      return (
        // @ts-expect-error React components returning null is fine
        <Component components={{ PostSeriesTOC: PostSeriesTOCLocal, ...(components || {}) }} {...rest} />
      );
    }
    return CustomMDXComponent;
  }, [post.code, PostSeriesTOCLocal]);

  const siblings = post.parent?.children;
  let idxInParent = -1;
  if (isInSeries) {
    idxInParent = (siblings || []).findIndex((child) => child.slug === post.slug);
  }

  const nextPost = idxInParent >= 0 && idxInParent > 0 && siblings ? siblings[idxInParent - 1] : null;
  const prevPost = idxInParent >= 0 && siblings && siblings.length > idxInParent + 1 ? siblings[idxInParent + 1] : null;

  const filteredRecommendations = recommendations
    .filter((post) => {
      if (nextPost) {
        if (post.slug === nextPost.slug) {
          return false;
        }
      }
      if (prevPost) {
        if (post.slug === prevPost.slug) {
          return false;
        }
      }
      return true;
    })
    .slice(0, 3);

  return (
    <Container currentUrl={currentUrl}>
      <article className="mx-auto mb-16 flex w-full max-w-2xl flex-col">
        <header className="mx-auto flex w-full flex-col md:max-w-xl">
          <h1 className="mb-2 text-center text-3xl font-bold tracking-tight text-black dark:text-white sm:text-4xl">
            {post.frontmatter.title}
          </h1>
          <p className="mt-3 w-full text-center text-gray-600 dark:text-gray-300">
            {format(post.frontmatter.publishedTime, "MMMM dd, yyyy")}
            {" • "}
            {post.readingTime.text}
          </p>
          {isInSeries ? (
            <p className="mt-1 w-full text-center text-gray-600 dark:text-gray-300">
              In series:{" "}
              <a
                href={`/blog/${post.parent?.slug || ""}`}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-400"
              >
                {post.parent?.frontmatter.title}
              </a>
            </p>
          ) : null}
        </header>
        <div className="prose mt-10 w-full max-w-none dark:prose-dark">
          <Component />
        </div>

        {nextPost || prevPost ? (
          <div
            className={clsx(
              prevPost ? "md:flex-row" : "md:flex-row-reverse",
              "mt-14 mb-4 flex w-full flex-col justify-between",
            )}
          >
            {prevPost ? (
              <a
                href={`/blog/${prevPost.slug}`}
                className="w-full transform rounded border border-gray-300 p-1 transition-all hover:scale-[1.01] dark:border-gray-700 md:mr-2 md:max-w-[45%]"
              >
                <div className="h-full bg-white px-3 py-2 dark:bg-gray-900">
                  <p className="text-gray-500 dark:text-gray-400">Prev in the series</p>
                  <p className="tracking-tight text-gray-800 dark:text-gray-100">{prevPost.frontmatter.title}</p>
                </div>
              </a>
            ) : null}
            {nextPost ? (
              <a
                href={`/blog/${nextPost.slug}`}
                className={clsx(
                  prevPost ? "mt-6 md:mt-0" : "",
                  "w-full transform rounded border border-gray-300 p-1 transition-all hover:scale-[1.01] dark:border-gray-700 md:ml-2 md:max-w-[45%]",
                )}
              >
                <div className="h-full bg-white px-3 py-2 dark:bg-gray-900">
                  <p className="text-gray-500 dark:text-gray-400">Next in the series</p>
                  <p className="tracking-tight text-gray-800 dark:text-gray-100">{nextPost.frontmatter.title}</p>
                </div>
              </a>
            ) : null}
          </div>
        ) : null}

        {filteredRecommendations.length > 0 && (
          <>
            <h2 className="mt-12 mb-4 text-2xl font-bold tracking-tight text-black dark:text-white md:text-4xl">
              Related
            </h2>
            {filteredRecommendations.map((post) => (
              <PostSummary key={post.slug} post={post} />
            ))}
          </>
        )}
      </article>
    </Container>
  );
}
