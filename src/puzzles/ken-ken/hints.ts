import { z } from 'zod'

import { KEN_KEN_SIZES, MAX_KEN_KEN_SIZE } from './model'

/**
 * Facts the browser worked out from the picture before sending it, offered to the model as things
 * to verify rather than as ground truth. Every field is optional: a fact that was not unambiguous
 * is left out, because a wrong one misleads the whole read.
 *
 * Zod lives here rather than in `api.ts` so the browser can import the type without the schema:
 * the client only ever imports this module with `import type`.
 */
const heavyEdgeSchema = z.strictObject({
  /**
  Spreadsheet-style names of the two cells the heavy border runs between.
  */
  a: z.string().max(3),
  b: z.string().max(3),
})

export const kenKenHintsSchema = z.strictObject({
  n: z.literal([...KEN_KEN_SIZES]).optional(),
  heavyEdges: z
    .array(heavyEdgeSchema)
    .max(2 * MAX_KEN_KEN_SIZE * (MAX_KEN_KEN_SIZE - 1))
    .optional(),
  /**
  Cells whose borders could not be measured, so `heavyEdges` says nothing about them.
  */
  unreadCells: z
    .array(z.string().max(3))
    .max(MAX_KEN_KEN_SIZE * MAX_KEN_KEN_SIZE)
    .optional(),
})

export type KenKenHints = z.infer<typeof kenKenHintsSchema>
