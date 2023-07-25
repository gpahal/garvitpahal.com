import type { FrontmatterSchema } from '@gpahal/markdoc'
import { pathPartsToPath } from '@gpahal/std/fs'

import type { ContentCollectionMap, FlattenedContentCollection, FlattenedContentCollectionItem } from '@/lib/content'

export function getFlattenedContentCollectionItemBySlug<TFrontmatterSchema extends FrontmatterSchema>(
  collection: FlattenedContentCollection<TFrontmatterSchema>,
  collectionMap: ContentCollectionMap<TFrontmatterSchema>,
  slug: string,
): FlattenedContentCollectionItem<TFrontmatterSchema> | undefined {
  const item = collectionMap.get(decodeURIComponent(slug))
  return item ? collection[item.index] : undefined
}

export function getFlattenedContentCollectionItemBySlugParts<TFrontmatterSchema extends FrontmatterSchema>(
  collection: FlattenedContentCollection<TFrontmatterSchema>,
  collectionMap: ContentCollectionMap<TFrontmatterSchema>,
  slugParts: string[],
): FlattenedContentCollectionItem<TFrontmatterSchema> | undefined {
  return getFlattenedContentCollectionItemBySlug(collection, collectionMap, pathPartsToPath(slugParts))
}
