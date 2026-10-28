import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'

import { z } from 'zod'

import { arePeriodsInOrder, contentDateSchema, periodsOf } from '@/lib/dates'
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
    pattern: '*.md',
    base: './src/content/blog',
  }),
  schema: z.strictObject({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    publishedOn: contentDateSchema,
    tags: z.array(z.string().trim().min(1)).optional(),
  }),
})

const periodSchema = z.strictObject({ startedOn: contentDateSchema, endedOn: contentDateSchema })
const PERIODS_OUT_OF_ORDER = {
  path: ['earlierPeriods'],
  message: 'earlierPeriods must run newest first, each ending before the next one starts',
}

/**
 * `resume` holds the resume's bullets, terser than the page's prose; `pnpm resume` prints them.
 */
const workExperiences = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/work-experiences',
  }),
  schema: z
    .strictObject({
      company: z.string().trim().min(1),
      href: z.url().optional(),
      role: z.string().trim().min(1).optional(),
      startedOn: contentDateSchema,
      endedOn: contentDateSchema.optional(),
      // A role left and later resumed. `startedOn` and `endedOn` are the latest period.
      earlierPeriods: z.array(periodSchema).min(1).optional(),
      resume: z.array(z.string().trim().min(1)).min(1),
    })
    .refine(isInOrder, OUT_OF_ORDER)
    .refine((entry) => arePeriodsInOrder(periodsOf(entry)), PERIODS_OUT_OF_ORDER),
})

const notablePersonalProjects = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/notable-personal-projects',
  }),
  schema: z
    .strictObject({
      project: z.string().trim().min(1),
      href: z.url().optional(),
      startedOn: contentDateSchema,
      endedOn: contentDateSchema.optional(),
      // The resume's one line; a project without it stays off the resume.
      resume: z.string().trim().min(1).optional(),
    })
    .refine(isInOrder, OUT_OF_ORDER),
})

/**
 * A case study per featured project at `/projects/<id>`, which the sitemap lists and no page links.
 */
const projectPages = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: './src/content/project-pages',
  }),
  schema: z.strictObject({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    href: z.url(),
  }),
})

const pages = defineCollection({
  loader: glob({
    pattern: '*.md',
    base: './src/content/pages',
  }),
  schema: z.strictObject({
    title: z.string().trim().min(1),
    // Without one the page gets the site's tagline.
    description: z.string().trim().min(1).optional(),
  }),
})

/**
 * The resume's own parts, in `profile.yaml`; its work and projects come from the collections above.
 */
const resume = defineCollection({
  loader: glob({
    pattern: '*.yaml',
    base: './src/content/resume',
  }),
  schema: z.strictObject({
    summary: z.string().trim().min(1),
    skills: z
      .array(z.strictObject({ label: z.string().trim().min(1), text: z.string().trim().min(1) }))
      .min(1),
    education: z
      .strictObject({
        school: z.string().trim().min(1),
        degree: z.string().trim().min(1),
        startedOn: contentDateSchema,
        endedOn: contentDateSchema,
        notes: z.string().trim().min(1).optional(),
      })
      .refine(isInOrder, OUT_OF_ORDER),
    awards: z.array(z.string().trim().min(1)).min(1),
  }),
})

export const collections = {
  pages,
  blog,
  workExperiences,
  notablePersonalProjects,
  projectPages,
  resume,
}
