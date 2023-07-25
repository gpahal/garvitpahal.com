import type { Project } from '@/lib/project'

import { ProjectSummary } from './project-summary'

export type ProjectSummariesProps = {
  projects: Project[]
}

export function ProjectSummaries({ projects }: ProjectSummariesProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {projects.map((project) => (
        <ProjectSummary key={project.name} project={project} />
      ))}
    </div>
  )
}
