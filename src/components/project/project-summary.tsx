import type { Project } from '@/lib/project'
import { Link } from '@/components/lib/link'

export type ProjectSummaryProps = {
  project: Project
}

export function ProjectSummary({ project: { name, description, href } }: ProjectSummaryProps) {
  return (
    <Link variant="unstyled" href={href} className="group flex w-full flex-col items-start no-underline">
      <span className="font-extramedium decoration-neutral-7 underline-offset-4 group-hover:underline group-focus-visible:underline">
        {name}
      </span>
      <span className="text-base text-fg-subtle">{description}</span>
    </Link>
  )
}
