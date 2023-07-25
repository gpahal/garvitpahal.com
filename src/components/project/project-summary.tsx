import type { Project } from '@/lib/project'
import { Link } from '@/components/lib/link'

export type ProjectSummaryProps = {
  project: Project
}

export function ProjectSummary({ project: { name, description, href } }: ProjectSummaryProps) {
  return (
    <Link
      variant="unstyled"
      href={href}
      className="flex w-full flex-col items-start gap-[0.125rem] border border-neutral-6/50 bg-bg-emphasis-2 px-3 pb-[0.55rem] pt-[0.5rem] no-underline hocus-visible:bg-bg-emphasis-3"
    >
      <span className="text-[1.05rem] font-extramedium">{name}</span>
      <span className="text-base text-fg-subtle">{description}</span>
    </Link>
  )
}
