import * as React from 'react'

import { MoveRightIcon } from 'lucide-react'

import type { Project } from '@/lib/project'
import { cn } from '@/lib/styles'
import { Link } from '@/components/lib/link'

import { ProjectSummary } from './project-summary'

export type ProjectSummariesProps = React.HTMLAttributes<HTMLDivElement> & {
  projects: Project[]
  maxProjectsVisible?: number
}

export function ProjectSummaries({ projects, maxProjectsVisible, className, ...props }: ProjectSummariesProps) {
  const visibleProjects = maxProjectsVisible ? projects.slice(0, maxProjectsVisible) : projects
  const showViewAllProjectsLink = maxProjectsVisible && projects.length > maxProjectsVisible

  return (
    <div {...props} className={cn('-my-2.5', className)}>
      {visibleProjects.map((project) => (
        <ProjectSummary key={project.name} project={project} />
      ))}
      {showViewAllProjectsLink ? (
        <div className="pt-1">
          <Link variant="unstyled" href="/projects" className="group block w-full">
            <span className="-mx-2.5 block rounded-md px-2.5 group-hover:bg-bg-emphasis-3 group-focus-visible:bg-bg-emphasis-3">
              <span className="inline-flex w-full flex-row items-center gap-1.5 py-2">
                <span className="inline-block font-medium">View all projects</span>
                <MoveRightIcon className="inline-block size-3.5 shrink-0" />
              </span>
            </span>
          </Link>
        </div>
      ) : null}
    </div>
  )
}
