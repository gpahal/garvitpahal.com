import { v } from 'convex/values'
import type { Infer } from 'convex/values'

export const NTFY_TOPIC = 'agenda'

/**
 * Production's, from the dev deployment too: a phone cannot reach a dev server.
 */
export const AGENDA_URL = 'https://garvitpahal.com/x/agenda'

/**
 * `sequenceId` names what the notification is about, so the next one about it replaces it on the
 * phone rather than stacking, and a retried publish replaces its own first copy.
 */
export const notificationValidator = v.object({
  sequenceId: v.string(),
  title: v.string(),
  message: v.string(),
  priority: v.optional(v.number()),
})

export type Notification = Infer<typeof notificationValidator>

export type NtfySettings = { url: string; token: string }

/**
 * `undefined` when either setting is missing, which `convex-env.ts` sets from Infisical.
 */
export function ntfySettingsOf(env: Record<string, string | undefined>): NtfySettings | undefined {
  const url = env.NTFY_URL?.trim() ?? ''
  const token = env.NTFY_TOKEN?.trim() ?? ''
  return url === '' || token === '' ? undefined : { url, token }
}

/**
 * Long enough for a slow server, short enough that a hung one is retried.
 */
const PUBLISH_TIMEOUT_MS = 10_000

export type PublishOutcome =
  | { outcome: 'sent' }
  | { outcome: 'refused'; status: number }
  | { outcome: 'unavailable'; reason: string }

/**
 * Publishes as JSON to the server's root, which takes the topic in the body. A refusal is the
 * server's answer to this request, so repeating it would get the same; anything else may pass on a
 * retry.
 */
export async function publish(
  fetchFn: typeof fetch,
  { url, token }: NtfySettings,
  { sequenceId, title, message, priority }: Notification,
): Promise<PublishOutcome> {
  // `AbortSignal.timeout` is newer than some runtimes.
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, PUBLISH_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: NTFY_TOPIC,
        sequence_id: sequenceId,
        title,
        message,
        priority,
        click: AGENDA_URL,
      }),
      signal: controller.signal,
    })
  } catch (error) {
    return { outcome: 'unavailable', reason: error instanceof Error ? error.name : 'unknown' }
  } finally {
    clearTimeout(timer)
  }
  if (response.ok) {
    return { outcome: 'sent' }
  }
  return response.status === 429 || response.status >= 500
    ? { outcome: 'unavailable', reason: `status ${String(response.status)}` }
    : { outcome: 'refused', status: response.status }
}
