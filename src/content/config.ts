import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

import { parse } from 'date-fns'

function validateAndTransformDateStr(dateStr: string, ctx: z.RefinementCtx) {
  try {
    const parsed = parse(`${dateStr} 12:00:00 Z`, 'dd/MM/yyyy HH:mm:ss X', new Date())
    if (!parsed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid date - use format 13/02/2022',
      })
      return z.NEVER
    }
    return parsed
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid date - use format 13/02/2022',
    })
    return z.NEVER
  }
}

const SCHEMA_DATE = z.string().transform((dateStr, ctx) => {
  return validateAndTransformDateStr(dateStr, ctx)
})

const SCHEMA_DATE_NULLISH = z
  .string()
  .nullish()
  .transform((dateStr, ctx) => {
    if (!dateStr) {
      return null
    }
    return validateAndTransformDateStr(dateStr, ctx)
  })

const blog = defineCollection({
  loader: glob({
    pattern: '**/*.mdx',
    base: './src/content/blog',
  }),
  schema: z.object({
    title: z.string(),
    publishedOn: SCHEMA_DATE,
    tags: z.array(z.string()).nullish(),
  }),
})

const workExperiences = defineCollection({
  loader: glob({
    pattern: '**/*.mdx',
    base: './src/content/work-experiences',
  }),
  schema: z.object({
    company: z.string(),
    role: z.string().nullish(),
    startedOn: SCHEMA_DATE,
    endedOn: SCHEMA_DATE_NULLISH,
  }),
})

const notablePersonalProjects = defineCollection({
  loader: glob({
    pattern: '**/*.mdx',
    base: './src/content/notable-personal-projects',
  }),
  schema: z.object({
    project: z.string(),
    startedOn: SCHEMA_DATE,
    endedOn: SCHEMA_DATE_NULLISH,
  }),
})

export const collections = {
  blog,
  workExperiences,
  notablePersonalProjects,
}
