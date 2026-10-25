import { z } from 'zod'

/**
 * In the one order a node is written in, so a schema serialises the same whatever zod emits first.
 */
const KEYWORDS = new Set([
  'type',
  'enum',
  'description',
  'items',
  'properties',
  'required',
  'additionalProperties',
])

/**
 * Every object must be closed with every property required, and a numeric range must be an enum;
 * numeric bounds are dropped. Any other keyword throws, but only after metering, so the extraction
 * registry's test builds every puzzle's schema first.
 */
export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _, ...jsonSchema } = z.toJSONSchema(schema, {
    target: 'draft-7',
    override: ({ jsonSchema: node, path }) => {
      const { minimum: _min, maximum: _max, ...rest } = node
      const keywords: Record<string, unknown> = {
        ...rest,
        ...(rest.type === 'number' && Array.isArray(rest.enum) && { type: 'integer' }),
      }
      const where = path.join('.') || 'the root'
      const unsupported = Object.keys(keywords).filter((key) => !KEYWORDS.has(key))
      if (unsupported.length > 0) {
        throw new Error(
          `Outside the structured-output subset at ${where}: ${unsupported.join(',')}`,
        )
      }
      if (keywords.type === 'object') {
        const required = Array.isArray(keywords.required) ? keywords.required.length : 0
        const isClosed = keywords.additionalProperties === false
        if (!isClosed || required !== Object.keys(keywords.properties ?? {}).length) {
          throw new Error(`An object takes no extra keys and no optional ones at ${where}`)
        }
      }
      for (const key of Object.keys(node)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- emptied in place, as its parent holds it
        delete node[key]
      }
      for (const key of KEYWORDS) {
        if (keywords[key] !== undefined) {
          node[key] = keywords[key]
        }
      }
    },
  })
  return jsonSchema
}
