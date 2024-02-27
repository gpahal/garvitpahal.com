import type { z } from 'zod'

import type { FrontmatterSchema, ParseResultSuccess, TransformConfig } from '@gpahal/markdoc'
import type {
  FileMap,
  FileMapIndex,
  FileMapIndexItem,
  FileMapItem,
  FlattenedFileMapIndex,
  FlattenedFileMapIndexItem,
} from '@gpahal/std/fs'

export type ContentData<TFrontmatterSchema extends FrontmatterSchema> = ParseResultSuccess<TFrontmatterSchema>

export type ContentCollectionItem<TFrontmatterSchema extends FrontmatterSchema> = FileMapIndexItem<
  ContentData<TFrontmatterSchema>
>

export type ContentCollection<TFrontmatterSchema extends FrontmatterSchema> = FileMapIndex<
  ContentData<TFrontmatterSchema>
>

export type ContentCollectionFileMap<TFrontmatterSchema extends FrontmatterSchema> = FileMap<
  ContentData<TFrontmatterSchema>
>
export type ContentCollectionFileMapItem<TFrontmatterSchema extends FrontmatterSchema> = FileMapItem<
  ContentData<TFrontmatterSchema>
>

export type ContentCollectionMap<TFrontmatterSchema extends FrontmatterSchema> = Map<
  string,
  ContentCollectionItem<TFrontmatterSchema>
>

export type FlattenedContentCollectionItem<TFrontmatterSchema extends FrontmatterSchema> = FlattenedFileMapIndexItem<
  ContentData<TFrontmatterSchema>
>

export type FlattenedContentCollection<TFrontmatterSchema extends FrontmatterSchema> = FlattenedFileMapIndex<
  ContentData<TFrontmatterSchema>
>

export type ContentCollectionMetadata<TFrontmatterSchema extends FrontmatterSchema> = {
  path: string
  frontmatterSchema: TFrontmatterSchema
  compareFileMapItems: (
    a: ContentCollectionFileMapItem<TFrontmatterSchema>,
    b: ContentCollectionFileMapItem<TFrontmatterSchema>,
  ) => number
  transformFileName?: (fileName: string, frontmatter: z.infer<TFrontmatterSchema>) => string
  transformConfig?: TransformConfig
}

export function createContentCollectionMap<TFrontmatterSchema extends FrontmatterSchema>(
  collection: ContentCollection<TFrontmatterSchema>,
): ContentCollectionMap<TFrontmatterSchema> {
  const map = new Map<string, ContentCollectionItem<TFrontmatterSchema>>()
  updateContentCollectionMapInternal(map, collection)
  return map
}

function updateContentCollectionMapInternal<TFrontmatterSchema extends FrontmatterSchema>(
  collectionMap: Map<string, ContentCollectionItem<TFrontmatterSchema>>,
  collection: ContentCollection<TFrontmatterSchema>,
): void {
  for (const collectionItem of collection) {
    collectionMap.set(collectionItem.path, collectionItem)
    if (collectionItem.children) {
      updateContentCollectionMapInternal(collectionMap, collectionItem.children)
    }
  }
}

export function getFlattenedContentCollectionItemByIndex<TFrontmatterSchema extends FrontmatterSchema>(
  collection: FlattenedContentCollection<TFrontmatterSchema>,
  index: number,
): FlattenedContentCollectionItem<TFrontmatterSchema> | undefined {
  return collection[index]
}

export function getPrevLeafFlattenedContentCollectionItemByIndex<TFrontmatterSchema extends FrontmatterSchema>(
  collection: FlattenedContentCollection<TFrontmatterSchema>,
  currIndex?: number,
): FlattenedContentCollectionItem<TFrontmatterSchema> | undefined {
  const sliced = currIndex == null ? collection : collection.slice(0, currIndex)
  return sliced.reverse().find((item) => !item.childrenIndices || item.childrenIndices.length === 0)
}

export function getNextLeafFlattenedContentCollectionItemByIndex<TFrontmatterSchema extends FrontmatterSchema>(
  collection: FlattenedContentCollection<TFrontmatterSchema>,
  currIndex?: number,
): FlattenedContentCollectionItem<TFrontmatterSchema> | undefined {
  const sliced = currIndex == null ? collection : collection.slice(currIndex + 1)
  return sliced.find((item) => !item.childrenIndices || item.childrenIndices.length === 0)
}
