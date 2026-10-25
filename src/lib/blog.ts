import { getCollection } from 'astro:content'
import type { CollectionEntry } from 'astro:content'

import { sortNewestFirst } from '@/lib/dates'

export async function listBlogPosts(): Promise<Array<CollectionEntry<'blog'>>> {
  return sortNewestFirst(await getCollection('blog'), (post) => ({
    date: post.data.publishedOn,
    id: post.id,
  }))
}
