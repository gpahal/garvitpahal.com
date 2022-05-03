import type { PostDetails } from "./post";

export type SeoParams = {
  title: string;
  browserTitle?: string;
  description?: string;
  image: string;
  article?: {
    publishedTime: number;
    tags?: string[];
  };
};

export function generateSocialMeta(
  title: string,
  browserTitle: string,
  description: string,
  image: string,
  article?: {
    publishedTime: number;
    tags?: string[];
  },
): SeoParams {
  const params: SeoParams = {
    title,
    browserTitle,
    description,
    image,
  };
  if (article) {
    params.article = {
      publishedTime: article.publishedTime,
      tags: article.tags,
    };
  }
  return params;
}

export function generateDefaultSeoParams(
  title = "Garvit Pahal",
  browserTitle = "Garvit Pahal",
  description = "Software engineer who enjoys football and movies",
  article?: {
    publishedTime: number;
    tags?: string[];
  },
): SeoParams {
  return generateSocialMeta(title, browserTitle, description, "/images/banner.png", article);
}

export function generatePostSeoParams(post: PostDetails): SeoParams {
  const title = `${post.frontmatter.title} - Garvit Pahal`;
  return generateDefaultSeoParams(title, title, post.frontmatter.title, {
    publishedTime: post.frontmatter.publishedTime,
    tags: post.frontmatter.tags,
  });
}
