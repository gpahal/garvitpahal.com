import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { wireFailure } from '../extract-wire'
import { classifyFailure, interpretResponse } from './openai-exchange'
import type { VisionResponse } from './openai-exchange'

const ACCOUNT = {
  message:
    'Reading is unavailable: the OpenAI account refused the request. Check its spend limit and API key',
}
const PICTURE = {
  message: 'OpenAI could not use this picture. Choose another picture',
  noRetry: true,
}
const REFUSED = {
  message: 'OpenAI refused the request. Enter the puzzle by hand for now',
  fallback: true,
  noRetry: true,
}
const UNFINISHED = {
  message: 'OpenAI could not finish reading the picture. Try again',
  fallback: true,
}

describe('classifyFailure', () => {
  // Account and picture refusals buy no fallback; only a picture refusal also hides Try again.
  it.each([
    [{ status: 401 }, ACCOUNT],
    [{ status: 429, code: 'insufficient_quota', type: 'insufficient_quota' }, ACCOUNT],
    [{ status: 400, code: 'image_parse_error' }, PICTURE],
    [{ status: 400, code: 'invalid_value' }, REFUSED],
    [{ status: 500 }, UNFINISHED],
  ])('classifies %j', (failure, wire) => {
    expect(wireFailure(classifyFailure(failure))).toEqual(wire)
  })
})

describe('interpretResponse', () => {
  const schema = z.strictObject({ cells: z.array(z.int()) })
  // Text that would parse, so only the refusal or the truncation keeps it off the screen.
  const parsable = { type: 'message', content: [{ type: 'output_text', text: '{"cells":[1]}' }] }
  const refusal = { type: 'message', content: [{ type: 'refusal', refusal: 'sk-proj-abc' }] }
  const reply = (fields: Partial<VisionResponse>): VisionResponse => ({
    status: 'completed',
    output: [parsable],
    usage: undefined,
    ...fields,
  })

  it.each([
    ['a refusal', reply({ output: [refusal, parsable] }), 'vision.refused'],
    ['a reply cut short', reply({ status: 'incomplete' }), 'vision.truncated'],
  ])('takes %s as unreadable, keeping its text out of the error', (_label, response, event) => {
    const logError = vi.fn()
    const outcome = interpretResponse(response, schema, logError)
    expect(outcome).toMatchObject({ ok: false, error: { code: 'model_failed' } })
    expect(logError).toHaveBeenCalledWith(event, expect.anything())
    expect(JSON.stringify(!outcome.ok && outcome.error)).not.toContain('sk-proj')
  })

  it('reads a completed reply', () => {
    expect(interpretResponse(reply({}), schema, vi.fn())).toEqual({
      ok: true,
      data: { cells: [1] },
    })
  })
})
