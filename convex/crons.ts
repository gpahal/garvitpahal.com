import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval('resume routine deletes', { hours: 1 }, internal.routines.resumeDeletes, {})

export default crons
