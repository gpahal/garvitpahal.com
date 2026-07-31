import { z } from 'zod'

/** Free of the Anthropic SDK, so the browser can import the types built from these. */
export const VISION_MODEL_IDS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] as const

export const VISION_EFFORTS = ['low', 'medium', 'high'] as const

/** Each retry is another model call, so the chain is bounded rather than open-ended. */
const MAX_FALLBACKS = 3

export const visionModelSchema = z
  .strictObject({
    id: z.enum(VISION_MODEL_IDS),
    effort: z.enum(VISION_EFFORTS).optional(),
  })
  // Anthropic answers this combination with a 400, so catch it before spending a request on it.
  .refine((model) => model.id !== 'claude-haiku-4-5' || model.effort === undefined, {
    error: 'claude-haiku-4-5 does not accept an effort',
  })

export type VisionModel = z.infer<typeof visionModelSchema>

/** Models arrive over the wire, so the allowlist is what stops a request naming an arbitrary one. */
export const visionModelsSchema = z.strictObject({
  primary: visionModelSchema,
  /** Tried in order, each only if the previous read looked wrong. Empty means no retry. */
  fallbacks: z.array(visionModelSchema).max(MAX_FALLBACKS),
})

export type VisionModels = z.infer<typeof visionModelsSchema>
