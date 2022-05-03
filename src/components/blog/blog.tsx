import { useState } from "react";

import BlogPostSummary from "~/components/blog/post-summary";
import Container from "~components/container";

import type { PostDetails } from "~lib/post";

export type BlogProps = {
  currentUrl: URL;
  allPosts: PostDetails[];
  featuredPosts: PostDetails[];
};

export default function Blog({ currentUrl, allPosts, featuredPosts }: BlogProps) {
  const [searchValue, setSearchValue] = useState("");
  const filteredBlogPosts = allPosts.filter((post) => {
    const searchValueLowercase = searchValue.toLowerCase();
    return (
      post.frontmatter.title.toLowerCase().includes(searchValueLowercase) ||
      post.frontmatter.description.toLowerCase().includes(searchValueLowercase) ||
      post.frontmatter.tags.findIndex((tag) => tag.toLowerCase().includes(searchValueLowercase))
    );
  });

  const hasManyPosts = allPosts.length >= 10;
  return (
    <Container currentUrl={currentUrl}>
      <div className="mx-auto mb-16 flex max-w-2xl flex-col items-start justify-center">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-black dark:text-white md:text-5xl">Blog</h1>
        <p className="mb-4 text-gray-600 dark:text-gray-400">
          Here, I share about my experiences as a programmer and new things I{"'"}m learning - like building web3
          applications and building an investment portfolio.
          {hasManyPosts
            ? ` I've written ${allPosts.length} articles on my blog. Use the box below to search them.`
            : null}
        </p>
        {hasManyPosts ? (
          <div className="relative mb-4 w-full">
            <input
              aria-label="Search posts"
              type="text"
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search posts"
              className="block w-full rounded-md border border-gray-200 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-900 dark:bg-gray-800 dark:text-gray-100"
            />
            <svg
              className="absolute right-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-300"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        ) : null}
        {hasManyPosts && !searchValue && featuredPosts.length && (
          <>
            <h2 className="mt-8 mb-4 text-2xl font-bold tracking-tight text-black dark:text-white md:text-4xl">
              Featured Posts
            </h2>
            {featuredPosts.map((post) => (
              <BlogPostSummary key={post.slug} post={post} />
            ))}
          </>
        )}
        {hasManyPosts ? (
          <h2 className="mt-8 mb-4 text-2xl font-bold tracking-tight text-black dark:text-white md:text-4xl">
            All Posts
          </h2>
        ) : (
          <div className="mt-2.5 mb-6 w-full border-t border-gray-200 dark:border-gray-700" />
        )}
        {!filteredBlogPosts.length && <p className="mb-4 text-gray-600 dark:text-gray-400">No posts found.</p>}
        {filteredBlogPosts.map((post) => (
          <BlogPostSummary key={post.slug} post={post} />
        ))}
      </div>
    </Container>
  );
}
