import { z } from 'zod'

import type {
  ContentCollection,
  ContentCollectionItem,
  ContentCollectionMap,
  ContentData,
  FlattenedContentCollection,
  FlattenedContentCollectionItem,
} from '@/lib/content'

import { SCHEMA_DATE } from './zod'

export const SCHEMA_BLOG_FRONTMATTER = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  publishedAt: SCHEMA_DATE,
  tags: z.array(z.string().trim().min(1)).default(() => []),
  isFeatured: z.boolean().nullish(),
})

export type BlogFrontmatterSchema = typeof SCHEMA_BLOG_FRONTMATTER

export type BlogFrontmatter = z.infer<BlogFrontmatterSchema>

export type BlogPostData = ContentData<BlogFrontmatterSchema>

export type BlogPost = ContentCollectionItem<BlogFrontmatterSchema>

export type Blog = ContentCollection<BlogFrontmatterSchema>

export type BlogMap = ContentCollectionMap<BlogFrontmatterSchema>

export type FlattenedBlogPost = FlattenedContentCollectionItem<BlogFrontmatterSchema>

export type FlattenedBlog = FlattenedContentCollection<BlogFrontmatterSchema>
