import postDBJSON from "~content/postDB.json";
import { filter } from "~lib/array";
import { comparePosts } from "~lib/post";
import { sanitizeSlugArray, slugToArray } from "~lib/string";

import type {
  Post,
  PostDB,
  PostDetails,
  PostDetailsDB,
  PostDetailsWithRecommendations,
  PostIndex,
  PostIndexInner,
} from "~lib/post";

const db = addDetailsToDB(postDBJSON as PostDB);

export function getPosts(limit?: number): PostDetails[] {
  if (limit && limit > 0) {
    return db.items.slice(0, limit);
  }
  return [...db.items];
}

export function getFeaturedPosts(limit?: number): PostDetails[] {
  return Array.from(filter(db.items, (item) => item.frontmatter.featured, limit));
}

export function getPost(slug: string | string[]): PostDetails | null {
  const slugArr = typeof slug === "string" ? slugToArray(slug) : sanitizeSlugArray(slug);
  if (slugArr.length === 0) {
    return null;
  }
  if (slugArr.findIndex((slug) => slug === "index") >= 0) {
    return null;
  }

  let currIndex: PostIndex | PostIndexInner = db.index;
  for (const currSlug of slugArr) {
    if (currSlug in currIndex) {
      const value = currIndex[currSlug];
      if (typeof value === "number") {
        return null;
      }
      currIndex = value;
    } else {
      return null;
    }
  }

  if ("index" in currIndex) {
    const { index } = currIndex;
    if (typeof index === "number" && index >= 0 && index < db.items.length) {
      return { ...db.items[index] };
    }
  }
  return null;
}

function getPostWithRecommendations(slug: string | string[]): PostDetailsWithRecommendations | null {
  const currPost = getPost(slug);
  if (!currPost) {
    return null;
  }

  const scores: [number, number][] = [];
  for (const [i, post] of db.items.entries()) {
    if (
      post.slug !== currPost.slug &&
      !(post.parent && (currPost.slug === post.parent.slug || currPost.parent?.slug === post.parent.slug))
    ) {
      scores.push([i, postsMatchScore(post, currPost) + (post.frontmatter.featured ? 1 : 0)]);
    }
  }

  const recommendations = scores
    .sort((a, b) => {
      if (a[1] > b[1]) {
        return -1;
      }
      if (a[1] < b[1]) {
        return 1;
      }
      return 0;
    })
    .slice(0, 5)
    .filter((pair) => pair[1] > 0)
    .map((pair) => db.items[pair[0]]);
  return {
    post: currPost,
    recommendations,
  };
}

function addDetailsToDB(postDB: PostDB): PostDetailsDB {
  const postDetailsDB: PostDetailsDB = {
    items: postDB.items,
    index: postDB.index,
  };

  const postIndex = postDB.index;
  for (const key of Object.keys(postIndex)) {
    if (key === "index") {
      continue;
    }

    const value = postIndex[key];
    if (value) {
      addDetailsToIndexNode(postDetailsDB.items, value);
    }
  }

  for (const post of postDetailsDB.items) {
    if (post.children && post.children.length > 1) {
      post.children.sort(comparePosts);
    }
  }

  return postDetailsDB;
}

export function mustGetPostWithRecommendations(slug: string | string[]): PostDetailsWithRecommendations {
  const postWithRecommendations = getPostWithRecommendations(slug);
  if (!postWithRecommendations) {
    throw new Error(`Post not found: ${slug}`);
  }
  return postWithRecommendations;
}

function addDetailsToIndexNode(items: PostDetails[], postIndex: PostIndexInner, parent?: PostDetails) {
  if (!("index" in postIndex)) {
    throw new Error("Index key missing from nested post index");
  }

  const { index } = postIndex;
  if (typeof index !== "number" || index < 0 || index >= items.length) {
    throw new Error("Invalid index key in nested post index");
  }

  const curr = items[index];
  curr.parent = parent;
  if (parent) {
    const currNonRecursive = { ...curr };
    delete currNonRecursive.parent;
    delete currNonRecursive.children;
    if (parent.children) {
      parent.children.push(currNonRecursive);
    } else {
      parent.children = [currNonRecursive];
    }
  }

  for (const key of Object.keys(postIndex)) {
    if (key === "index") {
      continue;
    }

    const value = postIndex[key];
    if (value) {
      addDetailsToIndexNode(items, value as PostIndexInner, curr);
    }
  }
}

function postsMatchScore(a: Post, b: Post): number {
  const aTags = a.frontmatter.tags;
  const aTagsSet = new Set(aTags);
  const bTags = b.frontmatter.tags;
  const bTagsSet = new Set(bTags);
  let score = 0;
  for (const tag of bTagsSet) {
    if (aTagsSet.has(tag)) {
      score++;
    }
  }
  return score;
}
