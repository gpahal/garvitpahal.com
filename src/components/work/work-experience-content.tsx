import type { WorkExperience } from '@/lib/work'
import { Content } from '@/components/content'

export type WorkExperienceContentProps = {
  workExperience: WorkExperience
}

export function WorkExperienceContent({ workExperience }: WorkExperienceContentProps) {
  return (
    <div className="prose relative">
      <Content content={workExperience.data.content} />
    </div>
  )
}
