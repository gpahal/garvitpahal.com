import BlogPostCard from "~components/blog/post-card";
import Container from "~components/container";
import SocialLinks from "~components/social-links";

import type { PostDetails } from "~lib/post";

const GRADIENTS = [
  "from-[#D8B4FE] to-[#818CF8]",
  "from-[#6EE7B7] via-[#3B82F6] to-[#9333EA]",
  "from-[#FDE68A] via-[#FCA5A5] to-[#FECACA]",
];

export type HomeProps = {
  currentUrl: URL;
  featuredPosts: PostDetails[];
};

export default function Home({ currentUrl, featuredPosts }: HomeProps) {
  return (
    <Container currentUrl={currentUrl}>
      <div className="mx-auto flex max-w-2xl flex-col items-start justify-center border-gray-200 pb-16 dark:border-gray-700">
        <div className="flex flex-col-reverse items-start sm:flex-row">
          <div className="mb-12 flex flex-col pr-8">
            <h1 className="mb-4 text-3xl font-bold tracking-tight text-black dark:text-white md:text-5xl">
              Hi 👋🏻 I{"'"}m Garvit
            </h1>
            <p className="mb-5 text-lg text-gray-500 dark:text-gray-400 md:text-xl">
              Software engineer who enjoys football and movies. I spend my days fixing bugs, rooting for FC Barcelona
              and stuck in Bangalore traffic.
            </p>
            <SocialLinks />
          </div>
          <div className="mb-8 mr-auto w-[156px] sm:w-auto sm:min-w-[156px] md:mb-0 md:ml-2">
            <picture>
              <source srcSet="/images/self-312x312.webp" type="image/webp" />
              <img
                alt="Garvit Pahal"
                height={156}
                width={156}
                src="/images/self-312x312.jpg"
                className="rounded-full grayscale filter"
              />
            </picture>
          </div>
        </div>
        <h2 className="mb-6 text-2xl font-bold tracking-tight text-black dark:text-white md:text-4xl">
          Featured Blog Posts
        </h2>
        <div className="flex w-full flex-col gap-6 md:flex-row">
          {featuredPosts.map((post, i) => (
            <BlogPostCard key={post.slug} post={post} gradient={GRADIENTS[i]} />
          ))}
        </div>
        <a
          href="/blog"
          className="mt-6 flex h-6 rounded-lg leading-7 text-gray-600 transition-all hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          See all posts
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="ml-2 mt-[0.16rem] h-6 w-6">
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.5 12h-15m11.667-4l3.333 4-3.333-4zm3.333 4l-3.333 4 3.333-4z"
            />
          </svg>
        </a>
      </div>
    </Container>
  );
}
