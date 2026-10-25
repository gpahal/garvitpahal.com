import { expect, test } from 'vitest'

import { PUZZLE_READS_BURST } from '@convex/shared/limits'

import { admissionsOf, agreementKey } from '../../vision/server/models'
import { toStrictJsonSchema } from '../../vision/server/strict-json-schema'
import { EXTRACTIONS } from './extraction-registry'

// Why the schema is built here first: `toStrictJsonSchema` in `strict-json-schema.ts`.
test.each(Object.entries(EXTRACTIONS))('builds the %s provider schema', (_, { responseSchema }) => {
  expect(toStrictJsonSchema(responseSchema)).toMatchObject({ type: 'object' })
})

// Why every call must differ: `agreementKey` in `vision/server/models.ts`.
test.each(Object.entries(EXTRACTIONS))(
  'makes every %s call differ in model or effort',
  (_, { models }) => {
    const keys = [...models.initial, ...models.fallback].map((model) => agreementKey(model))
    expect(new Set(keys).size).toBe(keys.length)
  },
)

test.each(Object.entries(EXTRACTIONS))(
  'fits a full %s read and an immediate Try again in the burst',
  (_, { models }) => {
    const read = [...models.initial, ...models.fallback].reduce(
      (spent, model) => spent + admissionsOf(model),
      0,
    )
    expect(2 * read).toBeLessThanOrEqual(PUZZLE_READS_BURST)
  },
)
