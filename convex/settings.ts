import { v } from 'convex/values'

import { ownerMutation, ownerQuery } from './lib/functionBuilders'
import { syncRoutines, syncSummary } from './lib/notifications'
import { assertTimeZone } from './lib/validate'

export const get = ownerQuery({
  args: {},
  returns: v.union(v.object({ timeZone: v.string() }), v.null()),
  handler: async (ctx) => {
    const row = await ctx.db.query('settings').first()
    return row && { timeZone: row.timeZone }
  },
})

/**
 * Each Agenda page reports its device's zone when it differs from the stored one, so two devices in
 * different zones take turns, and reminders follow whichever opened Agenda last. Only routine
 * reminders and the summary move: a task's show-at time is an instant.
 */
export const recordTimeZone = ownerMutation({
  args: { timeZone: v.string() },
  returns: v.null(),
  // eslint-disable-next-line sonarjs/no-invariant-returns -- `returns` declares null
  handler: async (ctx, { timeZone }) => {
    assertTimeZone(timeZone)
    const row = await ctx.db.query('settings').first()
    if (row?.timeZone === timeZone) {
      return null
    }
    if (row) {
      await ctx.db.patch('settings', row._id, { timeZone })
    } else {
      await ctx.db.insert('settings', { timeZone })
    }
    const now = Date.now()
    await syncRoutines(ctx, timeZone, now)
    await syncSummary(ctx, timeZone, now)
    return null
  },
})
