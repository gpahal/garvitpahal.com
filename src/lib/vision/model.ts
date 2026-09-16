import { z } from 'zod'

/**
 * The models a request may name. Free of the vision SDK, so the browser can import the types built
 * from these: a puzzle picks its own chain, sends it with the request, and the endpoint re-validates
 * it against this list rather than trusting it.
 */
export const VISION_MODEL_IDS = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'] as const

/**
How much the model may reason before answering. `none` disables it entirely.
*/
export const VISION_EFFORTS = ['none', 'low', 'medium', 'high', 'xhigh', 'max'] as const

/**
Processing tiers a request may ask for. `fast` is the provider's priority lane, at twice the price.
*/
export const VISION_TIERS = ['fast'] as const

/**
 * Every hedge is a simultaneous model call and the Worker may hold six connections open at once,
 * so the two waves together stay under that with room for nothing else.
 */
const MAX_HEDGES = 4
const MAX_FALLBACKS = 2

export const visionModelSchema = z.strictObject({
  id: z.enum(VISION_MODEL_IDS),
  /**
  Omitted means the provider's default for that model.
  */
  effort: z.enum(VISION_EFFORTS).optional(),
  /**
  Omitted means the standard tier.
  */
  tier: z.enum(VISION_TIERS).optional(),
})

export type VisionModel = z.infer<typeof visionModelSchema>

/**
Models arrive over the wire, so the allowlist is what stops a request naming an arbitrary one.
*/
export const visionModelsSchema = z.strictObject({
  /**
   * All fired at once, ordered weakest to strongest: a later read outranks an earlier one when the
   * browser has to choose between two it cannot verify.
   */
  hedges: z.array(visionModelSchema).min(1).max(MAX_HEDGES),
  /**
  Fired together only once every hedge has settled and the browser is still waiting.
  */
  fallbacks: z.array(visionModelSchema).max(MAX_FALLBACKS),
})

export type VisionModels = z.infer<typeof visionModelsSchema>
