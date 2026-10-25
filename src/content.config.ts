import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'

import { z } from 'zod'

import { contentDateSchema } from '@/lib/dates'
import type { DateOnly } from '@/lib/dates'

/**
 * Every schema is strict: a misspelt key such as `endedon` fails the build instead of being
 * dropped, which would silently render the entry as ongoing.
 */

/**
 * ISO date strings order like the dates they name.
 */
function isInOrder({ startedOn, endedOn }: { startedOn: DateOnly; endedOn?: DateOnly }): boolean {
  return endedOn === undefined || endedOn >= startedOn
}
const OUT_OF_ORDER = { path: ['endedOn'], message: 'endedOn must not be before startedOn' }

const blog = defineCollection({
  loader: glob({
    // A nested post's id would contain a slash, which `src/pages/blog/[id].astro` cannot serve.
    pattern: '*.mdx',
    base: './src/content/blog',
  }),
  schema: z.strictObject({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    publishedOn: contentDateSchema,
    tags: z.array(z.string().trim().min(1)).optional(),
  }),
})

const workExperiences = defineCollection({
  loader: glob({
    pattern: '**/*.mdx',
    base: './src/content/work-experiences',
  }),
  schema: z
    .strictObject({
      company: z.string().trim().min(1),
      role: z.string().trim().min(1).optional(),
      startedOn: contentDateSchema,
      endedOn: contentDateSchema.optional(),
    })
    .refine(isInOrder, OUT_OF_ORDER),
})

const notablePersonalProjects = defineCollection({
  loader: glob({
    pattern: '**/*.mdx',
    base: './src/content/notable-personal-projects',
  }),
  schema: z
    .strictObject({
      project: z.string().trim().min(1),
      startedOn: contentDateSchema,
      endedOn: contentDateSchema.optional(),
    })
    .refine(isInOrder, OUT_OF_ORDER),
})

const pages = defineCollection({
  loader: glob({
    pattern: '*.mdx',
    base: './src/content/pages',
  }),
  schema: z.strictObject({
    title: z.string().trim().min(1),
    // Without one the page gets the site's tagline.
    description: z.string().trim().min(1).optional(),
  }),
})

export const collections = {
  pages,
  blog,
  workExperiences,
  notablePersonalProjects,
}
