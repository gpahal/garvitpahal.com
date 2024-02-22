import { parse } from 'date-fns'
import { z } from 'zod'

import type {
  ContentCollection,
  ContentCollectionItem,
  ContentCollectionMap,
  ContentData,
  FlattenedContentCollection,
  FlattenedContentCollectionItem,
} from '@/lib/content'

export const BLOG_FRONTMATTER_SCHEMA = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  publishedAt: z.string().transform((dateStr, ctx) => {
    try {
      const parsed = parse(dateStr, 'dd/MM/yyyy', new Date()).getTime()
      if (!parsed || parsed <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '`publishedAt` is not a valid date - use format 13/02/2022',
        })
        return z.NEVER
      }
      return parsed
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`publishedAt` is not a valid date - use format 13/02/2022',
      })
      return z.NEVER
    }
  }),
  tags: z.array(z.string().trim().min(1)).default(() => []),
  isFeatured: z.boolean().nullish(),
})

export type BlogFrontmatterSchema = typeof BLOG_FRONTMATTER_SCHEMA

export type BlogFrontmatter = z.infer<BlogFrontmatterSchema>

export type BlogPostData = ContentData<BlogFrontmatterSchema>

export type BlogPost = ContentCollectionItem<BlogFrontmatterSchema>

export type Blog = ContentCollection<BlogFrontmatterSchema>

export type BlogMap = ContentCollectionMap<BlogFrontmatterSchema>

export type FlattenedBlogPost = FlattenedContentCollectionItem<BlogFrontmatterSchema>

export type FlattenedBlog = FlattenedContentCollection<BlogFrontmatterSchema>
