import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { wireFailure } from '../extract-wire'
import { classifyFailure, extractStructured, interpretResponse } from './openrouter-exchange'
import type { VisionResponse } from './openrouter-exchange'

const ACCOUNT = {
  message:
    'Reading is unavailable: the OpenRouter account refused the request. Check its credits and API key',
}
const PICTURE = {
  message: 'The model could not use this picture. Choose another picture',
  noRetry: true,
}
const REFUSED = {
  message: 'OpenRouter refused the request. Enter the puzzle by hand for now',
  fallback: true,
  noRetry: true,
}
const UNFINISHED = {
  message: 'The model could not finish reading the picture. Try again',
  fallback: true,
}

describe('classifyFailure', () => {
  // Account and picture refusals buy no fallback; only a picture refusal also hides Try again.
  it.each([
    [{ status: 401 }, ACCOUNT],
    [{ status: 402 }, ACCOUNT],
    [{ status: 403 }, ACCOUNT],
    [{ status: 403, isModeration: true }, PICTURE],
    [{ status: 400, providerCode: 'image_parse_error' }, PICTURE],
    [{ status: 400, providerCode: 'invalid_value' }, REFUSED],
    [{ status: 404 }, REFUSED],
    [{ status: 502 }, UNFINISHED],
  ])('classifies %j', (failure, wire) => {
    expect(wireFailure(classifyFailure(failure))).toEqual(wire)
  })
})

describe('interpretResponse', () => {
  const schema = z.strictObject({ cells: z.array(z.int()) })
  // Text that would parse, so only the refusal, the truncation or the error keeps it off the screen.
  const parsable = '{"cells":[1]}'
  const reply = (
    choice: Partial<NonNullable<VisionResponse['choices']>[number]>,
    fields: Partial<VisionResponse> = {},
  ): VisionResponse => ({
    choices: [{ finish_reason: 'stop', message: { content: parsable }, ...choice }],
    usage: undefined,
    ...fields,
  })

  it.each([
    [
      'a refusal',
      reply({ message: { content: parsable, refusal: 'sk-or-v1-abc' } }),
      'vision.refused',
    ],
    ['a filtered reply', reply({ finish_reason: 'content_filter' }), 'vision.refused'],
    ['a reply cut short', reply({ finish_reason: 'length' }), 'vision.truncated'],
    [
      'an error beside partial output',
      reply({ finish_reason: 'error', error: { code: 502, message: 'sk-or-v1-abc' } }),
      'vision.upstream_failed',
    ],
    [
      'an error with no choices',
      { choices: undefined, error: { code: 503, message: 'sk-or-v1-abc' }, usage: undefined },
      'vision.upstream_failed',
    ],
  ])('takes %s as a failure, keeping its text out of the error', (_label, response, event) => {
    const logError = vi.fn()
    const outcome = interpretResponse(response, schema, logError)
    expect(outcome).toMatchObject({ ok: false, error: { code: 'model_failed' } })
    expect(logError).toHaveBeenCalledWith(event, expect.anything())
    expect(JSON.stringify(!outcome.ok && outcome.error)).not.toContain('sk-or')
  })

  it('takes a moderation flag inside a reply as the picture', () => {
    const response = reply(
      { finish_reason: 'error', error: { code: 403, metadata: { reasons: ['flagged'] } } },
      {},
    )
    expect(interpretResponse(response, schema, vi.fn())).toMatchObject({
      ok: false,
      error: { code: 'model_rejected' },
    })
  })

  it.each([
    ['as a string', parsable],
    [
      'in text parts',
      [
        { type: 'text', text: '{"cells":' },
        { type: 'text', text: '[1]}' },
      ],
    ],
  ])('reads a completed reply %s', (_label, content) => {
    expect(interpretResponse(reply({ message: { content } }), schema, vi.fn())).toEqual({
      ok: true,
      data: { cells: [1] },
    })
  })
})

describe('extractStructured', () => {
  const options = {
    image: 'data:image/jpeg;base64,AAAA',
    schema: { type: 'object' },
    responseSchema: z.strictObject({ cells: z.array(z.int()) }),
    prompt: 'Read the grid',
    model: { id: 'openai/gpt-6.1-sol', effort: 'high', tier: 'fast' } as const,
    requestId: 'request',
    signal: new AbortController().signal,
  }

  it('sends the model settings, schema and image to OpenRouter', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      Response.json({
        choices: [{ finish_reason: 'stop', message: { content: '{"cells":[1]}' } }],
      }),
    )
    const outcome = await extractStructured(options, { apiKey: 'key', fetchFn })

    expect(outcome).toEqual({ ok: true, data: { cells: [1] } })
    const [url, init] = fetchFn.mock.calls[0] ?? []
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer key')
    expect(JSON.parse(init?.body as string)).toMatchObject({
      model: 'openai/gpt-6.1-sol',
      stream: false,
      reasoning: { effort: 'high' },
      service_tier: 'fast',
      provider: { require_parameters: true },
      response_format: {
        type: 'json_schema',
        json_schema: { strict: true, schema: options.schema },
      },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: options.image, detail: 'high' } },
            { type: 'text', text: options.prompt },
          ],
        },
      ],
    })
  })

  it('classifies an HTTP error by its status and provider code', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      Response.json(
        {
          error: { code: 400, message: 'Bad image', metadata: { provider_code: 'invalid_image' } },
        },
        { status: 400 },
      ),
    )
    await expect(extractStructured(options, { apiKey: 'key', fetchFn })).resolves.toMatchObject({
      ok: false,
      error: { code: 'model_rejected' },
    })
  })
})
