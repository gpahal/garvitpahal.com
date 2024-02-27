import { createFileMapIndex } from '@gpahal/std/fs'

import type { FlattenedBlog, FlattenedBlogPost } from '@/lib/blog'
import { createContentCollectionMap } from '@/lib/content'
import {
  getFlattenedContentCollectionItemBySlug,
  getFlattenedContentCollectionItemBySlugParts,
} from '@/lib/content.server'
import blogDbJson from '@/gen/content/blog/db.json'

const flattenedBlog = blogDbJson as FlattenedBlog
const blog = createFileMapIndex(flattenedBlog)
const blogMap = createContentCollectionMap(blog)

export function getBlog(): FlattenedBlog {
  return flattenedBlog
}

export function getBlogPostBySlug(slug: string): FlattenedBlogPost | undefined {
  return getFlattenedContentCollectionItemBySlug(flattenedBlog, blogMap, slug)
}

export function getBlogPostBySlugParts(slugParts: string[]): FlattenedBlogPost | undefined {
  return getFlattenedContentCollectionItemBySlugParts(flattenedBlog, blogMap, slugParts)
}

export function getTopLevelBlogPosts(limit?: number): FlattenedBlogPost[] {
  return flattenedBlog
    .filter((blogPost) => blogPost.parentIndex == null)
    .slice(0, limit && limit > 0 ? limit : undefined)
}

export function getAllBlogPosts(limit?: number): FlattenedBlogPost[] {
  return flattenedBlog.slice(0, limit && limit > 0 ? limit : undefined)
}

export function getRecommendedBlogPosts(blogPost: FlattenedBlogPost, limit?: number): FlattenedBlogPost[] {
  return flattenedBlog
    .map((candidatePost, i): [number, number] => {
      // Don't recommend the same blog post, parent, children or siblings
      if (
        candidatePost.path === blogPost.path ||
        candidatePost.index === blogPost.parentIndex ||
        (candidatePost.parentIndex != null &&
          (candidatePost.parentIndex === blogPost.index || candidatePost.parentIndex === blogPost.parentIndex))
      ) {
        return [-1, -1]
      }
      return [i, calculateBlogPostsMatchScore(candidatePost, blogPost)]
    })
    .filter((pair) => pair[0] >= 0 && pair[1] > 0)
    .sort((a, b) => {
      if (a[1] > b[1]) {
        return -1
      }
      if (a[1] < b[1]) {
        return 1
      }
      return 0
    })
    .slice(0, limit && limit > 0 ? limit : undefined)
    .map(([index]) => flattenedBlog[index]!)
    .map((recommendedPost) => getBlogPostBySlugParts(recommendedPost.pathParts)!)
}

function calculateBlogPostsMatchScore(a: FlattenedBlogPost, b: FlattenedBlogPost): number {
  const aTags = a.data.frontmatter.tags
  const aTagsSet = new Set(aTags)
  const bTags = b.data.frontmatter.tags
  const bTagsSet = new Set(bTags)
  let score = 0
  bTagsSet.forEach((tag) => {
    if (aTagsSet.has(tag)) {
      score++
    }
  })
  return score
}
