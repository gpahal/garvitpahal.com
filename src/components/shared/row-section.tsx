import type { ReactNode } from 'react'

type RowSectionProps = {
  title?: string
  /**
   * `h3` for a section under a heading of its own, such as a day's.
   */
  level?: 'h2' | 'h3'
  children: ReactNode
  after?: ReactNode
}

type SectionHeadingProps = { as?: 'h2' | 'h3'; children: ReactNode }

export function SectionHeading({ as: Heading = 'h2', children }: SectionHeadingProps): ReactNode {
  return <Heading className="text-sm font-medium text-muted-foreground">{children}</Heading>
}

export function RowSection({ title, level, children, after }: RowSectionProps): ReactNode {
  return (
    <section className="flex flex-col gap-2">
      {title === undefined ? undefined : <SectionHeading as={level}>{title}</SectionHeading>}
      {/* eslint-disable-next-line jsx-a11y-x/no-redundant-roles -- WebKit drops the list role once Tailwind's preflight sets `list-style: none` */}
      <ul role="list" className="flex flex-col gap-2">
        {children}
      </ul>
      {after}
    </section>
  )
}
