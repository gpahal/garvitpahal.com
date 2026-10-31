import { customCtx, customMutation, customQuery } from 'convex-helpers/server/customFunctions'
import { Triggers } from 'convex-helpers/server/triggers'

import type { DataModel } from '../_generated/dataModel'
import { mutation, query, internalMutation as rawInternalMutation } from '../_generated/server'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { requireOwner } from './auth'
import { storedTimeZone, syncRoutine, syncTask } from './notifications'
import { routineLogAggregate } from './routineLogAggregate'

/**
 * The builders below are the only way to a public function, so no handler can skip `requireOwner`
 * or these triggers; lint restricts raw builders to this module. Trigger writes share the source
 * mutation's rollback and commit.
 */
const triggers = new Triggers<DataModel>()

triggers.register('routineLogs', routineLogAggregate.trigger())

// Every write to a task or routine replaces, keeps or cancels its pending notification
// (`lib/notifications.ts`), so no mutation has to remember to.
triggers.register('tasks', async (ctx, { id, newDoc }) => {
  await syncTask(ctx, id, newDoc, Date.now())
})

triggers.register('routines', async (ctx, { id, newDoc }) => {
  await syncRoutine(ctx, id, newDoc, await storedTimeZone(ctx), Date.now())
})

/**
 * Handler tests seed rows through this so the aggregate stays in step.
 */
export const withTriggers = triggers.wrapDB

export const ownerQuery = customQuery(
  query,
  customCtx(async (ctx: QueryCtx) => {
    await requireOwner(ctx)
    return {}
  }),
)

export const ownerMutation = customMutation(
  mutation,
  customCtx(async (ctx: MutationCtx) => {
    await requireOwner(ctx)
    return withTriggers(ctx)
  }),
)

export const internalMutation = customMutation(rawInternalMutation, customCtx(withTriggers))
