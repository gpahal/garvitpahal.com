import type { Metadata } from 'next'

import { generatePageMetadata } from '@/lib/metadata'
import { PROJECTS } from '@/lib/project'
import { H1 } from '@/components/lib/heading'
import { ProjectSummaries } from '@/components/project/project-summaries'

export const metadata: Metadata = generatePageMetadata({
  pathname: '/projects',
  title: 'Projects - Garvit Pahal',
})

export default function ProjectsPage() {
  return (
    <>
      <header className="mb-5">
        <H1>Projects</H1>
      </header>
      <ProjectSummaries projects={PROJECTS} />
    </>
  )
}
