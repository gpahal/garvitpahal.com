import { z } from 'zod'

/**
 * The models a request may name. Free of the vision SDK, so the browser can import the types built
 * from these: a puzzle picks its own chain, sends it with the request, and the endpoint re-validates
 * it against this list rather than trusting it.
 */
export const VISION_MODEL_IDS = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'] as const

/** How much the model may reason before answering. `none` disables it entirely. */
export const VISION_EFFORTS = ['none', 'low', 'medium', 'high', 'xhigh', 'max'] as const

/** Each retry is another model call, so the chain is bounded rather than open-ended. */
const MAX_FALLBACKS = 3

export const visionModelSchema = z.strictObject({
  id: z.enum(VISION_MODEL_IDS),
  /** Omitted means the provider's default for that model. */
  effort: z.enum(VISION_EFFORTS).optional(),
})

export type VisionModel = z.infer<typeof visionModelSchema>

/** Models arrive over the wire, so the allowlist is what stops a request naming an arbitrary one. */
export const visionModelsSchema = z.strictObject({
  primary: visionModelSchema,
  /** Tried in order, each only if the previous read looked wrong. Empty means no retry. */
  fallbacks: z.array(visionModelSchema).max(MAX_FALLBACKS),
})

export type VisionModels = z.infer<typeof visionModelsSchema>
