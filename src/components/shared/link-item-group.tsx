import type { ReactNode } from 'react'

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item'

type LinkItem = {
  href: string
  title: string
  subtitle?: string
  aside?: string
}

type LinkItemGroupProps = {
  items: ReadonlyArray<LinkItem>
}

/**
 * In React because an `.astro` page cannot hand `Item` its anchor through `render`. Titles stay
 * headings so screen readers can jump between entries.
 */
export function LinkItemGroup({ items }: LinkItemGroupProps): ReactNode {
  return (
    // The negative margins are `Item`'s padding plus its border, so titles line up with the page's
    // text; `w-auto` stops `ItemGroup`'s `w-full` pushing past the column.
    <ItemGroup className="-mx-3.25 -my-2.75 w-auto gap-0">
      {items.map((item, i) => (
        <div key={item.href} role="listitem">
          {/* Inside the list item, since a `list` may hold only those. */}
          {i > 0 && <ItemSeparator className="mx-3.25 my-1 data-horizontal:w-auto" />}
          <Item
            // `muted/50` keeps descriptions at 4.5:1 in light mode. The hover repeats `Item`'s `[a]:`
            // so `cn` replaces that class rather than losing to its specificity.
            className="active:bg-muted/50 [a]:hover:bg-muted/50"
            // eslint-disable-next-line jsx-a11y-x/anchor-has-content -- `Item` renders its children into the anchor
            render={<a href={item.href} />}
          >
            <ItemContent>
              <ItemTitle className="line-clamp-none text-base font-normal">
                <h2>{item.title}</h2>
              </ItemTitle>
              {item.subtitle !== undefined && (
                <ItemDescription className="line-clamp-none">{item.subtitle}</ItemDescription>
              )}
            </ItemContent>
            {item.aside !== undefined && (
              <ItemActions>
                <ItemDescription className="line-clamp-none whitespace-nowrap">
                  {item.aside}
                </ItemDescription>
              </ItemActions>
            )}
          </Item>
        </div>
      ))}
    </ItemGroup>
  )
}
