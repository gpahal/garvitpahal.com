import { v } from 'convex/values'

import { internalAction } from './_generated/server'
import { logError } from './lib/log'
import { notificationValidator, ntfySettingsOf, publish as publishTo } from './lib/ntfy'

/**
 * Run through the retrier (`sendNotification`), which retries a throw: a refusal or missing
 * settings is logged and not thrown, as a retry would meet the same.
 */
export const publish = internalAction({
  args: { notification: notificationValidator },
  returns: v.null(),
  handler: async (_ctx, { notification }) => {
    const settings = ntfySettingsOf(process.env)
    if (!settings) {
      logError('ntfy.not_configured')
      return null
    }
    const result = await publishTo(fetch, settings, notification)
    if (result.outcome === 'refused') {
      logError('ntfy.refused', { status: result.status })
    } else if (result.outcome === 'unavailable') {
      logError('ntfy.unavailable', { reason: result.reason })
      throw new Error(`ntfy is unavailable: ${result.reason}`)
    }
    return null
  },
})
