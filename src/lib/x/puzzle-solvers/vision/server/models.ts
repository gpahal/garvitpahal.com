import { PHASE_CALLS } from '../extract-wire'
import type { ReadPhase } from '../extract-wire'

type VisionEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/**
 * The provider's priority lane, at twice the price.
 */
type VisionTier = 'fast'

type VisionModelId = 'gpt-6-sol' | 'gpt-6-luna'

export type ChainModel = {
  id: VisionModelId
  effort?: VisionEffort
  tier?: VisionTier
}

export type VisionModels = {
  initial: [ChainModel, ChainModel]
  fallback: [ChainModel]
}

// Each chain must have exactly `PHASE_CALLS` entries.
void (PHASE_CALLS satisfies { [P in ReadPhase]: VisionModels[P]['length'] })

/**
 * The priority lane costs twice the price, so a call on it spends two admissions.
 */
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
