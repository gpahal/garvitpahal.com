import { expect, test } from 'vitest'

import { admissionsOf, agreementKey } from './models'
import type { ChainModel } from './models'

test('refuses an effort the model does not accept', () => {
  // @ts-expect-error -- 6.1 Sol's reasoning is mandatory, so OpenRouter refuses `none`
  const model: ChainModel = { id: 'openai/gpt-6.1-sol', effort: 'none' }
  expect(agreementKey(model)).toBe('openai/gpt-6.1-sol@none')
})

test('charges the fast lane twice', () => {
  expect(admissionsOf({ id: 'openai/gpt-6.1-terra', effort: 'none', tier: 'fast' })).toBe(2)
  expect(admissionsOf({ id: 'openai/gpt-6.1-terra', effort: 'none' })).toBe(1)
})
