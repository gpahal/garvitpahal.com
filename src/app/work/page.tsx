import type { Metadata } from 'next'

import { generatePageMetadata } from '@/lib/metadata'
import { PROJECTS } from '@/lib/project'
import { getTopLevelWorkExperiences } from '@/lib/work.server'
import { H1, H2 } from '@/components/lib/heading'
import { ProjectSummaries } from '@/components/project/project-summaries'
import { WorkExperiences } from '@/components/work/work-experiences'

export const metadata: Metadata = generatePageMetadata({
  pathname: '/work',
  title: 'Work history - Garvit Pahal',
})

export default function WorkPage() {
  const workExperiences = getTopLevelWorkExperiences()

  return (
    <>
      <header className="mb-5">
        <H1>My work history</H1>
      </header>
      <WorkExperiences workExperiences={workExperiences} />

      <H2 className="mb-4 mt-12">Notable Projects</H2>
      <ProjectSummaries projects={PROJECTS} />
    </>
  )
}
