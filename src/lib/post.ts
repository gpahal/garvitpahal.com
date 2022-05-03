export type Post = {
  slugArr: string[];
  slug: string;
  frontmatter: PostFrontmatter;
  readingTime: ReadingTime;
  code: string;
};

export type PostDetails = Post & {
  parent?: PostDetails;
  children?: Post[];
};

export type PostDetailsWithRecommendations = {
  post: PostDetails;
  recommendations: PostDetails[];
};

export type PostFrontmatter = {
  title: string;
  description: string;
  publishedTime: number;
  featured: boolean;
  tags: string[];
};

export type ReadingTime = {
  text: string;
  time: number;
  words: number;
  minutes: number;
};

export type PostIndex = { [key: string]: PostIndexInner };

export type PostIndexInner = { [key: string]: PostIndexInner | number };

export type PostDB = {
  items: Post[];
  index: PostIndex;
};

export type PostDetailsDB = {
  items: PostDetails[];
  index: PostIndex;
};

export function comparePosts(a: Post, b: Post): number {
  if (a.frontmatter.publishedTime > b.frontmatter.publishedTime) {
    return -1;
  }
  if (a.frontmatter.publishedTime < b.frontmatter.publishedTime) {
    return 1;
  }
  return 0;
}
