import workDbJson from '@/gen/content/work/db.json'

import type { FlattenedWork, FlattenedWorkExperience } from './work'

const flattenedWork = workDbJson as FlattenedWork

export function getTopLevelWorkExperiences(limit?: number): FlattenedWorkExperience[] {
  return flattenedWork
    .filter((workExperience) => workExperience.parentIndex == null)
    .slice(0, limit && limit > 0 ? limit : undefined)
}
