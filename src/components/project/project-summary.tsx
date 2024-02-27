import type { Project } from '@/lib/project'
import { Link } from '@/components/lib/link'

export type ProjectSummaryProps = {
  project: Project
}

export function ProjectSummary({ project: { name, description, href } }: ProjectSummaryProps) {
  return (
    <div className="py-0.5">
      <Link variant="unstyled" href={href} className="group block w-full">
        <span className="-mx-2.5 block rounded-md px-2.5 group-hover:bg-bg-emphasis-3 group-focus-visible:bg-bg-emphasis-3">
          <span className="inline-flex w-full flex-col pb-2.5 pt-2">
            <span className="inline-block font-semimedium">{name}</span>
            <span className="shrink-0 text-[0.9375rem]/[1.35rem] text-fg-subtle/80">{description}</span>
          </span>
        </span>
      </Link>
    </div>
  )
}
