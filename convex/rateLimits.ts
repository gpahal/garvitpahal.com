import { DAY, MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { v } from 'convex/values'

import { components } from './_generated/api'
import { ownerMutation } from './lib/functionBuilders'
import { PUZZLE_READS_BURST } from './shared/limits'

/**
 * Singleton buckets, as a per-session key would multiply the budget. An admission is one
 * standard-priced model call and a call on the priority lane costs two (`admissionsOf` in
 * `src/lib/x/puzzle-solvers/vision/server/models.ts`), so the limits weigh calls by price. At most
 * 300 admissions in any 24 hours.
 */
const LIMITS = {
  puzzleReadsBurst: { kind: 'token bucket', rate: 4, period: MINUTE, capacity: PUZZLE_READS_BURST },
  puzzleReadsDaily: { kind: 'token bucket', rate: 150, period: DAY, capacity: 150 },
} as const

export const rateLimiter = new RateLimiter(components.rateLimiter, LIMITS)

const ADMITTED = v.object({ ok: v.literal(true) })
const REFUSED = v.object({ ok: v.literal(false), retryAfterMs: v.number() })

/**
 * Spends a model call's admissions, or returns when to come back rather than throwing. The caller
 * names no limit, and both are checked before either is spent, so a refusal spends nothing. The
 * Worker meters each paid call itself, so a page holding the owner token can only spend more.
 */
export const consumePuzzleRead = ownerMutation({
  args: { cost: v.union(v.literal(1), v.literal(2)) },
  returns: v.union(ADMITTED, REFUSED),
  handler: async (ctx, { cost }) => {
    const [burst, daily] = await Promise.all([
      rateLimiter.check(ctx, 'puzzleReadsBurst', { count: cost }),
      rateLimiter.check(ctx, 'puzzleReadsDaily', { count: cost }),
    ])
    if (!burst.ok || !daily.ok) {
      return {
        ok: false as const,
        retryAfterMs: Math.max(burst.ok ? 0 : burst.retryAfter, daily.ok ? 0 : daily.retryAfter),
      }
    }
    // Cannot refuse: the checks above ran in this transaction.
    await rateLimiter.limit(ctx, 'puzzleReadsBurst', { count: cost, throws: true })
    await rateLimiter.limit(ctx, 'puzzleReadsDaily', { count: cost, throws: true })
    return { ok: true as const }
  },
})
