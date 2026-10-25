import { useId } from 'react'
import type { ReactNode } from 'react'

import { MutedText } from '@/components/shared/typography'
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'

type OpenRowProps = {
  title: string
  description?: string
  children?: ReactNode
  aside?: ReactNode
  onOpen: () => void
}

/**
 * A list row that only opens its subject, so a stray tap cannot write data. The button is the title
 * stretched over the row, since a button's content is flattened into its name; `children` sit
 * beside it and keep their roles.
 */
export function OpenRow({ title, description, children, aside, onOpen }: OpenRowProps): ReactNode {
  const id = useId()
  return (
    <Item
      variant="outline"
      className="relative has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50 has-enabled:hover:bg-muted/50"
    >
      <ItemContent className="min-w-0">
        <ItemTitle>
          <button
            type="button"
            className="text-left outline-none after:absolute after:inset-0 after:rounded-[inherit] enabled:cursor-pointer"
            // The aside's wrapper always renders; the description only when there is one.
            aria-describedby={
              description === undefined ? `${id}-aside` : `${id}-description ${id}-aside`
            }
            onClick={onOpen}
          >
            {title}
          </button>
        </ItemTitle>
        {description === undefined ? undefined : (
          <ItemDescription id={`${id}-description`}>{description}</ItemDescription>
        )}
        {children}
      </ItemContent>
      <div id={`${id}-aside`} className="contents">
        {aside}
      </div>
    </Item>
  )
}

export function RowTime({ children }: { children: string }): ReactNode {
  return <MutedText className="tabular-nums">{children}</MutedText>
}
