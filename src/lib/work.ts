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

export const SCHEMA_WORK_FRONTMATTER = z.object({
  company: z.string().trim().min(1),
  url: z.string().url().nullish(),
  designation: z.string().trim().min(1),
  startedAt: SCHEMA_DATE,
  endedAt: SCHEMA_DATE.nullish(),
})

export type WorkFrontmatterSchema = typeof SCHEMA_WORK_FRONTMATTER

export type WorkFrontmatter = z.infer<WorkFrontmatterSchema>

export type WorkExperienceData = ContentData<WorkFrontmatterSchema>

export type WorkExperience = ContentCollectionItem<WorkFrontmatterSchema>

export type Work = ContentCollection<WorkFrontmatterSchema>

export type WorkMap = ContentCollectionMap<WorkFrontmatterSchema>

export type FlattenedWorkExperience = FlattenedContentCollectionItem<WorkFrontmatterSchema>

export type FlattenedWork = FlattenedContentCollection<WorkFrontmatterSchema>
