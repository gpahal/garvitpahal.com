import type { Project } from '@/lib/project'
import { cn } from '@/lib/styles'

import { ProjectSummary } from './project-summary'

export type ProjectSummariesProps = React.HTMLAttributes<HTMLDivElement> & {
  projects: Project[]
}

export function ProjectSummaries({ projects, className, ...props }: ProjectSummariesProps) {
  return (
    <div {...props} className={cn('-my-2.5 divide-y divide-neutral-6/40', className)}>
      {projects.map((project) => (
        <ProjectSummary key={project.name} project={project} />
      ))}
    </div>
  )
}
