import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { toStrictJsonSchema } from './strict-json-schema'

describe('toStrictJsonSchema', () => {
  it('writes a range as an integer enum, drops the bounds and keeps one keyword order', () => {
    const schema = z.strictObject({
      size: z.literal([4, 5]).describe('How big.'),
      rows: z.array(z.int()).describe('The rows.'),
    })
    expect(JSON.stringify(toStrictJsonSchema(schema))).toBe(
      JSON.stringify({
        type: 'object',
        properties: {
          size: { type: 'integer', enum: [4, 5], description: 'How big.' },
          rows: { type: 'array', description: 'The rows.', items: { type: 'integer' } },
        },
        required: ['size', 'rows'],
        additionalProperties: false,
      }),
    )
  })

  it('refuses what the provider would refuse', () => {
    expect(() => toStrictJsonSchema(z.looseObject({ a: z.string() }))).toThrow(/extra keys/)
    expect(() => toStrictJsonSchema(z.strictObject({ a: z.string().optional() }))).toThrow(
      /optional/,
    )
    expect(() => toStrictJsonSchema(z.strictObject({ a: z.string().min(1) }))).toThrow(/minLength/)
    const capped = z.strictObject({ a: z.array(z.string()).max(3) })
    expect(() => toStrictJsonSchema(capped)).toThrow(/maxItems/)
  })
})
