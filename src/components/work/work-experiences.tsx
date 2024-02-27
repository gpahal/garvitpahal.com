import { MoveRightIcon } from 'lucide-react'

import { cn } from '@/lib/styles'
import type { WorkExperience } from '@/lib/work'
import { Accordion } from '@/components/lib/accordion'
import { Link } from '@/components/lib/link'

import { WorkExperienceComponent } from './work-experience-component'

export type WorkExperiencesProps = React.HTMLAttributes<HTMLDivElement> & {
  workExperiences: WorkExperience[]
  maxWorkExperiencesVisible?: number
}

export function WorkExperiences({
  workExperiences,
  maxWorkExperiencesVisible,
  className,
  ...props
}: WorkExperiencesProps) {
  const visibleWorkExperiences = maxWorkExperiencesVisible
    ? workExperiences.slice(0, maxWorkExperiencesVisible)
    : workExperiences
  const showViewAllWorkExperiencesLink = maxWorkExperiencesVisible && workExperiences.length > maxWorkExperiencesVisible

  return (
    <div {...props} className={cn('-my-2.5', className)}>
      <Accordion type="single" className="w-full" collapsible={true}>
        {visibleWorkExperiences.map((workExperience) => (
          <WorkExperienceComponent key={workExperience.path} workExperience={workExperience} />
        ))}
      </Accordion>
      {showViewAllWorkExperiencesLink ? (
        <div className="pt-1">
          <Link variant="unstyled" href="/work" className="group block w-full">
            <span className="-mx-2.5 block rounded-md px-2.5 group-hover:bg-bg-emphasis-3 group-focus-visible:bg-bg-emphasis-3">
              <span className="inline-flex w-full flex-row items-center gap-1.5 py-2">
                <span className="inline-block font-medium">View all work experiences</span>
                <MoveRightIcon className="inline-block size-3.5 shrink-0" />
              </span>
            </span>
          </Link>
        </div>
      ) : null}
    </div>
  )
}
