import actionRetrier from '@convex-dev/action-retrier/convex.config'
import aggregate from '@convex-dev/aggregate/convex.config'
import rateLimiter from '@convex-dev/rate-limiter/convex.config'
import { defineApp } from 'convex/server'

const app = defineApp()

app.use(rateLimiter)

app.use(actionRetrier)

app.use(aggregate, { name: 'routineLogAggregate' })

export default app
