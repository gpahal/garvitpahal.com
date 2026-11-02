import { PHASE_CALLS } from '../extract-wire'
import type { ReadPhase } from '../extract-wire'

type VisionEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/**
 * The priority lane, at twice the price. OpenRouter treats it as a request: the logged
 * `serviceTier` is the lane used and billed.
 */
type VisionTier = 'fast'

/**
 * OpenRouter model IDs and the efforts each accepts (its `reasoning.supported_efforts`). A model
 * added here must accept an image, `reasoning` and `response_format`: `require_parameters` makes
 * OpenRouter refuse the call rather than drop one.
 */
type VisionModelEfforts = {
  'openai/gpt-6-luna': VisionEffort
  'openai/gpt-6.1-terra': VisionEffort
  /**
   * Reasoning is mandatory, so OpenRouter refuses `none`.
   */
  'openai/gpt-6.1-sol': Exclude<VisionEffort, 'none'>
}

export type ChainModel = {
  [Id in keyof VisionModelEfforts]: {
    id: Id
    effort?: VisionModelEfforts[Id]
    tier?: VisionTier
  }
}[keyof VisionModelEfforts]

export type VisionModels = {
  initial: [ChainModel, ChainModel]
  fallback: [ChainModel]
}

// Each chain must have exactly `PHASE_CALLS` entries.
void (PHASE_CALLS satisfies { [P in ReadPhase]: VisionModels[P]['length'] })

export function admissionsOf(model: ChainModel): 1 | 2 {
  return model.tier === 'fast' ? 2 : 1
}

export function modelKey(model: ChainModel): string {
  return `${agreementKey(model)}${model.tier ? `+${model.tier}` : ''}`
}

/**
 * Without the tier: the same model and effort on another lane is not independent agreement, so
 * every configuration in a chain must differ by this key.
 */
export function agreementKey(model: ChainModel): string {
  return `${model.id}@${model.effort ?? 'default'}`
}
