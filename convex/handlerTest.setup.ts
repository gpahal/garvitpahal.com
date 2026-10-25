import aggregateTest from '@convex-dev/aggregate/test'
import rateLimiterTest from '@convex-dev/rate-limiter/test'
import { convexTest } from 'convex-test'

import schema from './schema'

/**
 * The second dot in this file's name keeps Convex from deploying it.
 */

/**
 * Every extension Convex deploys (`ENTRY_POINT_EXTENSIONS` in its bundler). `_generated/` must
 * match, as that is how `convexTest` finds the functions' root.
 */
const modules = import.meta.glob([
  './**/*.{js,mjs,cjs,ts,tsx,mts,cts,jsx}',
  '!./**/*.test.*',
  '!./**/*.setup.*',
])

/**
 * Read once, so a test that stubs `OWNER_EMAIL` still signs in as the configured owner.
 */
export const OWNER_EMAIL = process.env.OWNER_EMAIL

/**
 * A fresh deployment with no identity.
 */
export function handlerTest() {
  const t = convexTest({ schema, modules, transactionLimits: true })
  aggregateTest.register(t, 'routineLogAggregate')
  rateLimiterTest.register(t)
  return t
}

export function setup() {
  return handlerTest().withIdentity({ email: OWNER_EMAIL })
}
