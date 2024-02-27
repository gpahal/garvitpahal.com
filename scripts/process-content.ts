import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { formatDistanceToNow } from 'date-fns'
import sizeOf from 'image-size'
import fetch from 'node-fetch'

import { formatParseDirectoryResultErrors, linkSchema, parseDirectory, type FrontmatterSchema } from '@gpahal/markdoc'
import { FS_MODULE } from '@gpahal/std-node/fs'
import { createFlattenedFileMapIndex, type FileMap } from '@gpahal/std/fs'
import { isAbsoluteUrl } from '@gpahal/std/url'

import { SCHEMA_WORK_FRONTMATTER, type WorkFrontmatterSchema } from '@/lib/work'

import { SCHEMA_BLOG_FRONTMATTER, type BlogFrontmatterSchema } from '../src/lib/blog'
import type { ContentCollectionMetadata } from '../src/lib/content'

const DIRNAME = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR_PATH = join(DIRNAME, '..', 'public')
const CONTENT_DIR_PATH = join(DIRNAME, '..', 'content')
const CONTENT_GEN_DB_DIR_PATH = join(DIRNAME, '..', 'src', 'gen', 'content')

async function transformImageSrcAndGetSize(src: string): Promise<{ src: string; width?: number; height?: number }> {
  let input: string | Buffer = src
  if (isAbsoluteUrl(src)) {
    const resp = await fetch(src)
    input = Buffer.from(await resp.arrayBuffer())
  } else {
    if (!src.startsWith('/')) {
      throw new Error('Image src should start with a slash')
    }

    src = join('/images', src)
    input = join(PUBLIC_DIR_PATH, src)
  }

  const { width, height } = sizeOf(input)
  if (width == null || height == null) {
    throw new Error('Image size could not be calculated')
  }
  return { src, width, height }
}

async function generateCollectionDb<TFrontmatterSchema extends FrontmatterSchema>(
  collection: ContentCollectionMetadata<TFrontmatterSchema>,
): Promise<void> {
  const startTime = new Date()
  await generateCollectionDbInner(collection)
  console.info(`Time: ${formatDistanceToNow(startTime, { includeSeconds: true })}\n`)
}

async function generateCollectionDbInner<TFrontmatterSchema extends FrontmatterSchema>(
  collection: ContentCollectionMetadata<TFrontmatterSchema>,
): Promise<void> {
  const { path: collectionPath, frontmatterSchema, transformFileName, transformConfig } = collection
  console.info(`Generating collection db for ${collectionPath}...`)

  const contentDir = join(CONTENT_GEN_DB_DIR_PATH, collectionPath)
  await mkdir(contentDir, { mode: 0o755, recursive: true })
  const collectionContentDirPath = join(CONTENT_DIR_PATH, collectionPath)
  const result = await parseDirectory(FS_MODULE, collectionContentDirPath, () => 'index.mdoc', {
    frontmatterSchema,
    transformConfig: {
      ...(transformConfig || {}),
      tags: {
        link: {
          ...linkSchema,
          attributes: {
            ...(linkSchema.attributes || {}),
            variant: {
              type: String,
              default: 'highlighted',
              matches: ['unstyled', 'highlighted', 'hover-highlighted', 'link'],
            },
          },
        },
        'code-block': {
          render: 'CodeBlock',
          attributes: {
            'data-content': { type: String },
            'data-name': { type: String },
            'data-language': { type: String },
            'data-variant': { type: String },
          },
        },
        'code-block-group': {
          render: 'CodeBlockGroup',
        },
        alert: {
          render: 'Alert',
          attributes: {
            variant: {
              type: String,
              default: 'info',
              matches: ['info', 'warn', 'error'],
            },
          },
        },
        badges: {
          render: 'Badges',
        },
        badge: {
          render: 'Badge',
        },
        'series-toc': {
          render: 'SeriesToc',
        },
        ...(transformConfig?.tags || {}),
      },
      image: { transformImageSrcAndGetSize },
      codeAndFence: {
        theme: {
          light: 'github-light',
          dark: 'github-dark',
        },
        wrapperTagName: 'code-block',
      },
    },
    transformFileName: (fileName, fsFileMapFileItem) =>
      transformFileName && fsFileMapFileItem.data.isSuccessful
        ? transformFileName(fileName, fsFileMapFileItem.data.frontmatter)
        : fileName,
  })
  if (!result.isSuccessful) {
    console.error(
      `Error generating collection db for ${collectionPath}:\n\n${formatParseDirectoryResultErrors(result.data)}`,
    )
    process.exit(1)
  }

  const data = result.data satisfies FileMap<unknown>
  const flattenedFileMapIndex = createFlattenedFileMapIndex(data, collection.compareFileMapItems)
  const contentGenDbFilePath = join(contentDir, 'db.json')
  await writeFile(contentGenDbFilePath, JSON.stringify(flattenedFileMapIndex), { mode: 0o644 })

  console.info(`Generated collection db for ${collectionPath}`)
}

const BLOG_CONTENT_COLLECTION_METADATA: ContentCollectionMetadata<BlogFrontmatterSchema> = {
  path: 'blog',
  frontmatterSchema: SCHEMA_BLOG_FRONTMATTER,
  compareFileMapItems: (a, b) => b.data.frontmatter.publishedAt - a.data.frontmatter.publishedAt,
}

const WORK_CONTENT_COLLECTION_METADATA: ContentCollectionMetadata<WorkFrontmatterSchema> = {
  path: 'work',
  frontmatterSchema: SCHEMA_WORK_FRONTMATTER,
  compareFileMapItems: (a, b) => b.data.frontmatter.startedAt - a.data.frontmatter.startedAt,
}

async function generateCollectionDbs(): Promise<void> {
  await generateCollectionDb(BLOG_CONTENT_COLLECTION_METADATA)
  await generateCollectionDb(WORK_CONTENT_COLLECTION_METADATA)
}

void generateCollectionDbs()
