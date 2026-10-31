import { describe, expect, it, vi } from 'vitest'

import { ntfySettingsOf, publish } from './ntfy'

const SETTINGS = { url: 'https://ntfy.example.com', token: 'tk_test' }
const NOTIFICATION = { sequenceId: 'task-1', title: 'Pay rent', message: 'Due now' }

function answering(status: number) {
  return vi.fn<typeof fetch>(async () => new Response('{}', { status }))
}

describe('ntfySettingsOf', () => {
  it('needs both settings, trimmed', () => {
    expect(
      ntfySettingsOf({ NTFY_URL: ' https://ntfy.example.com ', NTFY_TOKEN: 'tk_test\n' }),
    ).toEqual(SETTINGS)
    expect(
      ntfySettingsOf({ NTFY_URL: 'https://ntfy.example.com', NTFY_TOKEN: ' ' }),
    ).toBeUndefined()
    expect(ntfySettingsOf({ NTFY_TOKEN: 'tk_test' })).toBeUndefined()
  })
})

describe('publish', () => {
  it('posts JSON to the server root with the token, the agenda topic and the sequence', async () => {
    const fetchFn = answering(200)
    expect(await publish(fetchFn, SETTINGS, NOTIFICATION)).toEqual({ outcome: 'sent' })
    const [url, init] = fetchFn.mock.calls[0]!
    expect(url).toBe(SETTINGS.url)
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer tk_test' }))
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
      topic: 'agenda',
      sequence_id: 'task-1',
      title: 'Pay rent',
      message: 'Due now',
      click: 'https://garvitpahal.com/x/agenda',
    })
  })

  it('tells a refusal, which a retry would meet again, from a failure worth retrying', async () => {
    expect(await publish(answering(403), SETTINGS, NOTIFICATION)).toEqual({
      outcome: 'refused',
      status: 403,
    })
    expect(await publish(answering(429), SETTINGS, NOTIFICATION)).toEqual({
      outcome: 'unavailable',
      reason: 'status 429',
    })
    expect(await publish(answering(502), SETTINGS, NOTIFICATION)).toEqual({
      outcome: 'unavailable',
      reason: 'status 502',
    })
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await publish(offline, SETTINGS, NOTIFICATION)).toEqual({
      outcome: 'unavailable',
      reason: 'TypeError',
    })
  })
})
