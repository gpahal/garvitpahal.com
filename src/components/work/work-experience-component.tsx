import { format } from 'date-fns'

import type { WorkExperience } from '@/lib/work'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/lib/accordion'

import { WorkExperienceContent } from './work-experience-content'

export type WorkExperienceComponentProps = {
  workExperience: WorkExperience
}

export function WorkExperienceComponent({ workExperience }: WorkExperienceComponentProps) {
  return (
    <AccordionItem value={workExperience.path}>
      <AccordionTrigger>
        <span className="inline-flex w-full flex-col items-start">
          <span className="text-base font-medium">{workExperience.data.frontmatter.company}</span>
          <span className="text-[0.9375rem]/[1.35rem] text-fg-subtle/80">{`${workExperience.data.frontmatter.designation}, ${format(workExperience.data.frontmatter.startedAt, 'MMM yyyy')} — ${workExperience.data.frontmatter.endedAt ? format(workExperience.data.frontmatter.endedAt, 'MMM yyyy') : 'now'}`}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="-mb-1 -mt-3">
        <WorkExperienceContent workExperience={workExperience} />
      </AccordionContent>
    </AccordionItem>
  )
}
